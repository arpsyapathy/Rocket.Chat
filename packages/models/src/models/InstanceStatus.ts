import type { IInstanceStatus } from '@rocket.chat/core-typings';
import type { IInstanceStatusModel } from '@rocket.chat/model-typings';
import type { Db, UpdateResult, DeleteResult, ChangeStream } from 'mongodb';

import { BaseRaw } from './BaseRaw';

export class InstanceStatusRaw extends BaseRaw<IInstanceStatus> implements IInstanceStatusModel {
	constructor(db: Db) {
		super(db, 'instances', undefined, {
			preventSetUpdatedAt: true,
			collectionNameResolver(name) {
				return name;
			},
		});
	}

	async getActiveInstanceCount(): Promise<number> {
		return this.countDocuments({ _updatedAt: { $gt: new Date(Date.now() - process.uptime() * 1000 - 2000) } });
	}

	watchActiveInstances(): ChangeStream<IInstanceStatus> {
		return this.col.watch();
	}

	async removeInstanceById(_id: IInstanceStatus['_id']): Promise<DeleteResult> {
		return this.deleteOne({ _id });
	}

	async setDocumentHeartbeat(documentId: string): Promise<UpdateResult> {
		return this.updateOne({ _id: documentId }, { $currentDate: { _updatedAt: true } });
	}

	async upsertInstance(instance: Partial<IInstanceStatus>): Promise<IInstanceStatus | null> {
		return this.findOneAndUpdate(
			{
				_id: instance._id,
			},
			{
				$set: instance,
				$currentDate: {
					_createdAt: true,
					_updatedAt: true,
				},
			},
			{
				upsert: true,
				returnDocument: 'after',
			},
		);
	}

	async updateConnections(_id: IInstanceStatus['_id'], conns: number) {
		return this.updateOne(
			{
				_id,
			},
			{
				$set: {
					'extraInformation.conns': conns,
				},
			},
		);
	}
}
