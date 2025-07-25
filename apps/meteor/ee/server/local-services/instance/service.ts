import os from 'os';

import type { AppStatusReport } from '@rocket.chat/core-services';
import { Apps, License, ServiceClassInternal } from '@rocket.chat/core-services';
import type { IInstanceStatus } from '@rocket.chat/core-typings';
import { InstanceStatus, defaultPingInterval, indexExpire } from '@rocket.chat/instance-status';
import { InstanceStatus as InstanceStatusRaw } from '@rocket.chat/models';
import EJSON from 'ejson';
import type { BrokerNode } from 'moleculer';
import { ServiceBroker, Transporters, Serializers } from 'moleculer';

import { getLogger } from './getLogger';
import { getTransporter } from './getTransporter';
import { SystemLogger } from '../../../../server/lib/logger/system';
import { StreamerCentral } from '../../../../server/modules/streamer/streamer.module';
import { AppsEngineNoNodesFoundError } from '../../../../server/services/apps-engine/service';
import type { IInstanceService } from '../../sdk/types/IInstanceService';

const hostIP = process.env.INSTANCE_IP ? String(process.env.INSTANCE_IP).trim() : 'localhost';

const { Base } = Serializers;

class EJSONSerializer extends Base {
	serialize(obj: any): Buffer {
		return Buffer.from(EJSON.stringify(obj));
	}

	deserialize(buf: Buffer): any {
		return EJSON.parse(buf.toString());
	}
}

export class InstanceService extends ServiceClassInternal implements IInstanceService {
	protected name = 'instance';

	private broadcastStarted = false;

	private transporter: Transporters.TCP | Transporters.NATS;

	private broker: ServiceBroker;

	private troubleshootDisableInstanceBroadcast = false;

	constructor() {
		super();

		this.onEvent('license.module', async ({ module, valid }) => {
			if (module === 'scalability' && valid) {
				await this.startBroadcast();
			}
		});

		this.onEvent('watch.settings', async ({ clientAction, setting }): Promise<void> => {
			if (clientAction === 'removed') {
				return;
			}

			const { _id, value } = setting;
			if (_id !== 'Troubleshoot_Disable_Instance_Broadcast') {
				return;
			}

			if (typeof value !== 'boolean') {
				return;
			}

			if (this.troubleshootDisableInstanceBroadcast === value) {
				return;
			}

			this.troubleshootDisableInstanceBroadcast = value;
		});
	}

	async created() {
		const transporter = getTransporter({
			transporter: process.env.TRANSPORTER,
			port: process.env.TCP_PORT,
			extra: process.env.TRANSPORTER_EXTRA,
		});

		const isTransporterTCP = typeof transporter !== 'string';

		this.transporter = isTransporterTCP ? new Transporters.TCP(transporter) : new Transporters.NATS({ url: transporter });

		this.broker = new ServiceBroker({
			nodeID: InstanceStatus.id(),
			transporter: this.transporter,
			serializer: new EJSONSerializer(),
			heartbeatInterval: defaultPingInterval,
			heartbeatTimeout: indexExpire,
			...getLogger(process.env),
		});

		this.broker.createService({
			name: 'matrix',
			events: {
				broadcast(ctx: any) {
					const { eventName, streamName, args } = ctx.params;
					const { nodeID } = ctx;

					const fromLocalNode = nodeID === InstanceStatus.id();
					if (fromLocalNode) {
						return;
					}

					const instance = StreamerCentral.instances[streamName];
					if (!instance) {
						// return 'stream-not-exists';
						return;
					}

					if (instance.serverOnly) {
						instance.__emit(eventName, ...args);
					} else {
						// @ts-expect-error not sure why it thinks _emit needs an extra argument
						StreamerCentral.instances[streamName]._emit(eventName, args);
					}
				},
			},
			actions: {
				getAppsStatus(_ctx) {
					return Apps.getAppsStatusLocal();
				},
			},
		});

		if (isTransporterTCP) {
			const changeStream = InstanceStatusRaw.watchActiveInstances();

			changeStream
				.on('change', (change) => {
					if (change.operationType === 'update') {
						return;
					}
					if (change.operationType === 'insert' && change.fullDocument?.extraInformation?.tcpPort) {
						this.connectNode(change.fullDocument);
						return;
					}
					if (change.operationType === 'delete') {
						this.disconnectNode(change.documentKey._id);
					}
				})
				.once('error', (err) => {
					SystemLogger.error({ msg: 'Error in InstanceStatus change stream:', err });
				});
		}
	}

	private connectNode(record: IInstanceStatus) {
		if (record._id === InstanceStatus.id()) {
			return;
		}

		const { host, tcpPort } = record.extraInformation;

		(this.broker?.transit?.tx as any).addOfflineNode(record._id, host, tcpPort);
	}

	private disconnectNode(nodeId: string) {
		(this.broker.transit?.tx as any).nodes.disconnected(nodeId, false);
		(this.broker.transit?.tx as any).nodes.nodes.delete(nodeId);
	}

	async started() {
		await this.broker.start();

		const instance = {
			host: hostIP,
			port: String(process.env.PORT).trim(),
			tcpPort: (this.broker.transit?.tx as any)?.nodes?.localNode?.port,
			os: {
				type: os.type(),
				platform: os.platform(),
				arch: os.arch(),
				release: os.release(),
				uptime: os.uptime(),
				loadavg: os.loadavg(),
				totalmem: os.totalmem(),
				freemem: os.freemem(),
				cpus: os.cpus().length,
			},
			nodeVersion: process.version,
		};

		await InstanceStatus.registerInstance('rocket.chat', instance);

		try {
			const hasLicense = await License.hasModule('scalability');
			if (!hasLicense) {
				return;
			}

			await this.startBroadcast();
		} catch (error) {
			console.error('Instance service did not start correctly', error);
		}
	}

	private async startBroadcast() {
		if (this.broadcastStarted) {
			return;
		}

		this.broadcastStarted = true;

		StreamerCentral.on('broadcast', this.sendBroadcast.bind(this));
	}

	private sendBroadcast(streamName: string, eventName: string, args: unknown[]) {
		if (this.troubleshootDisableInstanceBroadcast) {
			return;
		}

		void this.broker.broadcast('broadcast', { streamName, eventName, args });
	}

	async getInstances(): Promise<BrokerNode[]> {
		return this.broker.call('$node.list', { onlyAvailable: true });
	}

	async getAppsStatusInInstances(): Promise<AppStatusReport> {
		const instances = await this.getInstances();

		if (instances.length < 2) {
			throw new AppsEngineNoNodesFoundError();
		}

		const control: Promise<void>[] = [];
		const statusByApp: AppStatusReport = {};

		instances.forEach((instance) => {
			const { id: instanceId } = instance;

			control.push(
				(async () => {
					const appsStatus = await this.broker.call<Awaited<ReturnType<(typeof Apps)['getAppsStatusLocal']>>, null>(
						'matrix.getAppsStatus',
						null,
						{ nodeID: instanceId },
					);

					if (!appsStatus) {
						throw new Error(`Failed to get apps status from instance ${instanceId}`);
					}

					appsStatus.forEach(({ status, appId }) => {
						if (!statusByApp[appId]) {
							statusByApp[appId] = [];
						}

						statusByApp[appId].push({ instanceId, isLocal: instance.local, status });
					});
				})(),
			);
		});

		await Promise.all(control);

		return statusByApp;
	}
}
