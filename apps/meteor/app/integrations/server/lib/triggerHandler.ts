import type {
	IIntegrationHistory,
	IMessage,
	IOutgoingIntegration,
	IUser,
	OutgoingIntegrationEvent,
	IRoom,
	RequiredField,
	AtLeast,
} from '@rocket.chat/core-typings';
import { Integrations, Users, Rooms, Messages } from '@rocket.chat/models';
import { serverFetch as fetch } from '@rocket.chat/server-fetch';
import { wrapExceptions } from '@rocket.chat/tools';
import { Meteor } from 'meteor/meteor';
import _ from 'underscore';

import type { OutgoingRequestData } from './ScriptEngine';
import { getRoomByNameOrIdWithOptionToJoin } from '../../../lib/server/functions/getRoomByNameOrIdWithOptionToJoin';
import { processWebhookMessage } from '../../../lib/server/functions/processWebhookMessage';
import { notifyOnIntegrationChangedById } from '../../../lib/server/lib/notifyListener';
import { settings } from '../../../settings/server';
import { outgoingEvents } from '../../lib/outgoingEvents';
import { outgoingLogger } from '../logger';
import { IsolatedVMScriptEngine } from './isolated-vm/isolated-vm';
import { updateHistory } from './updateHistory';

type Trigger = Record<string, Record<string, any>>;

type MessageWithEditedAt = IMessage & { editedAt?: Date };
type ArgumentsObject = {
	event?: OutgoingIntegrationEvent;
	message?: MessageWithEditedAt;
	room?: IRoom;
	owner?: IUser;
	user?: IUser;
};
type IntegrationData = {
	token: string;
	bot: boolean;
	trigger_word?: string;
	channel_id?: string;
	channel_name?: string;
	message_id?: string;
	timestamp?: Date;
	user_id?: string;
	user_name?: string;
	text?: string;
	siteUrl?: string;
	alias?: string;
	isEdited?: boolean;
	tmid?: string;
	user?: Partial<IUser>;
	room?: IRoom;
	message?: IMessage;
	owner?: Partial<IUser>;
};

class RocketChatIntegrationHandler {
	private successResults: number[];

	private triggers: Trigger;

	private ivmEngine: IsolatedVMScriptEngine<false>;

	constructor() {
		this.successResults = [200, 201, 202];
		this.triggers = {};
		this.ivmEngine = new IsolatedVMScriptEngine(false);
	}

	addIntegration(record: IOutgoingIntegration): void {
		outgoingLogger.debug(`Adding the integration ${record.name} of the event ${record.event}!`);
		let channels = [];
		if (record.event && !outgoingEvents[record.event].use.channel) {
			outgoingLogger.debug('The integration doesnt rely on channels.');
			// We don't use any channels, so it's special ;)
			channels = ['__any'];
		} else if (_.isEmpty(record.channel)) {
			outgoingLogger.debug('The integration had an empty channel property, so it is going on all the public channels.');
			channels = ['all_public_channels'];
		} else {
			outgoingLogger.debug('The integration is going on these channels:', record.channel);
			channels = ([] as string[]).concat(record.channel);
		}

		for (const channel of channels) {
			if (!this.triggers[channel]) {
				this.triggers[channel] = {};
			}

			this.triggers[channel][record._id] = record;
		}
	}

	// eslint-disable-next-line no-unused-vars
	getEngine(_integration: any): IsolatedVMScriptEngine<false> {
		return this.ivmEngine;
	}

	removeIntegration(record: AtLeast<IOutgoingIntegration, '_id'>): void {
		for (const trigger of Object.values(this.triggers)) {
			delete trigger[record._id];
		}
	}

	isTriggerEnabled(trigger: IOutgoingIntegration): boolean {
		for (const trig of Object.values(this.triggers)) {
			if (trig[trigger._id]) {
				return trig[trigger._id].enabled;
			}
		}

		return false;
	}

	// Trigger is the trigger, nameOrId is a string which is used to try and find a room, room is a room, message is a message, and data contains "user_name" if trigger.impersonateUser is truthful.
	async sendMessage({
		trigger,
		nameOrId = '',
		room,
		message,
		data,
	}: {
		trigger: IOutgoingIntegration;
		nameOrId?: string;
		room?: IRoom;
		message: { channel: string; bot?: Record<string, any>; message: Partial<IMessage> };
		data: IntegrationData;
	}): Promise<{ channel: string; message: Partial<IMessage> }[] | undefined> {
		let user: IUser | null = null;
		// Try to find the user who we are impersonating
		if (trigger.impersonateUser) {
			user = await Users.findOneByUsernameIgnoringCase(data.user_name);
		}

		// If they don't exist (aka the trigger didn't contain a user) then we set the user based upon the
		// configured username for the integration since this is required at all times.
		if (!user) {
			user = await Users.findOneByUsernameIgnoringCase(trigger.username);
		}

		if (!user) {
			outgoingLogger.error(`The user "${trigger.username}" doesn't exist, so we can't send the message.`);
			return;
		}

		let tmpRoom;
		if (nameOrId || trigger.targetRoom || message.channel) {
			tmpRoom =
				(await getRoomByNameOrIdWithOptionToJoin({
					user,
					nameOrId: nameOrId || message.channel || trigger.targetRoom || '',
					errorOnEmpty: false,
				})) || room;
		} else {
			tmpRoom = room;
		}

		// If no room could be found, we won't be sending any messages but we'll warn in the logs
		if (!tmpRoom) {
			outgoingLogger.warn(
				`The Integration "${trigger.name}" doesn't have a room configured nor did it provide a room to send the message to.`,
			);
			return;
		}

		outgoingLogger.debug(`Found a room for ${trigger.name} which is: ${tmpRoom.name} with a type of ${tmpRoom.t}`);

		message.bot = { i: trigger._id };

		const defaultValues: {
			alias: string;
			avatar: string;
			emoji: string;
			channel: string;
		} = {
			alias: trigger.alias || '',
			avatar: trigger.avatar || '',
			emoji: trigger.emoji || '',
			channel: tmpRoom.t === 'd' ? `@${tmpRoom._id}` : `#${tmpRoom._id}`,
		};

		return processWebhookMessage(message, user as IUser & { username: RequiredField<IUser, 'username'> }, defaultValues);
	}

	eventNameArgumentsToObject(...args: unknown[]) {
		const argObject: ArgumentsObject = {
			event: args[0] as OutgoingIntegrationEvent | undefined,
		};

		switch (argObject.event) {
			case 'sendMessage':
				if (args.length >= 3) {
					argObject.message = args[1] as IMessage;
					argObject.room = args[2] as IRoom;
				}
				break;
			case 'fileUploaded':
				if (args.length >= 2) {
					const arghhh: Record<string, any> = args[1] as Record<string, any>;
					argObject.user = arghhh.user as IUser;
					argObject.room = arghhh.room as IRoom;
					argObject.message = arghhh.message as IMessage;
				}
				break;
			case 'roomArchived':
				if (args.length >= 3) {
					argObject.room = args[1] as IRoom;
					argObject.user = args[2] as IUser;
				}
				break;
			case 'roomCreated':
				if (args.length >= 3) {
					argObject.owner = args[1] as IUser;
					argObject.room = args[2] as IRoom;
				}
				break;
			case 'roomJoined':
			case 'roomLeft':
				if (args.length >= 3) {
					argObject.user = args[1] as IUser;
					argObject.room = args[2] as IRoom;
				}
				break;
			case 'userCreated':
				if (args.length >= 2) {
					argObject.user = args[1] as IUser;
				}
				break;
			default:
				outgoingLogger.warn(`An Unhandled Trigger Event was called: ${argObject.event}`);
				argObject.event = undefined;
				break;
		}

		outgoingLogger.debug({
			msg: `Got the event arguments for the event: ${argObject.event}`,
			argObject,
		});

		return argObject;
	}

	mapEventArgsToData(data: IntegrationData, { event, message, room, owner, user }: ArgumentsObject) {
		/* The "services" field contains sensitive information such as
		the user's password hash. To prevent this information from being
		sent to the webhook, we're checking and removing it by destructuring
		the user and owner objects while discarding the "services" field.
		*/

		const omitServicesField = (object: IUser) => {
			const { services, ...objectWithoutServicesField } = object;
			return objectWithoutServicesField;
		};

		const userWithoutServicesField = user?.services ? omitServicesField(user) : user;
		const ownerWithoutServicesField = owner?.services ? omitServicesField(owner) : owner;

		if (!room || !message) {
			outgoingLogger.warn(`The integration ${event} was called but the room or message was not defined.`);
			return;
		}

		switch (event) {
			case 'sendMessage':
				data.channel_id = room._id;
				data.channel_name = room.name;
				data.message_id = message._id;
				data.timestamp = message.ts;
				data.user_id = message.u._id;
				data.user_name = message.u.username;
				data.text = message.msg;
				data.siteUrl = settings.get('Site_Url');

				if (message.alias) {
					data.alias = message.alias;
				}

				if (message.bot) {
					data.bot = Boolean(message.bot); // TODO: need to double check this, since it makes no sense
				}

				if (message.editedAt) {
					data.isEdited = true;
				}

				if (message.tmid) {
					data.tmid = message.tmid;
				}
				break;
			case 'fileUploaded':
				data.channel_id = room._id;
				data.channel_name = room.name;
				data.message_id = message._id;
				data.timestamp = message.ts;
				data.user_id = message.u._id;
				data.user_name = message.u.username;
				data.text = message.msg;
				data.user = userWithoutServicesField;
				data.room = room;
				data.message = message;

				if (message.alias) {
					data.alias = message.alias;
				}

				if (message.bot) {
					data.bot = Boolean(message.bot); // TODO: need to double check this, since it makes no sense
				}
				break;
			case 'roomCreated':
				if (!owner) {
					outgoingLogger.warn(`The integration ${event} was called but the owner was not defined.`);
					return;
				}
				data.channel_id = room._id;
				data.channel_name = room.name;
				data.timestamp = room.ts;
				data.user_id = owner._id;
				data.user_name = owner.username;
				data.owner = ownerWithoutServicesField;
				data.room = room;
				break;
			case 'roomArchived':
			case 'roomJoined':
			case 'roomLeft':
				if (!user) {
					outgoingLogger.warn(`The integration ${event} was called but the owner was not defined.`);
					return;
				}
				data.timestamp = new Date();
				data.channel_id = room._id;
				data.channel_name = room.name;
				data.user_id = user._id;
				data.user_name = user.username;
				data.user = userWithoutServicesField;
				data.room = room;

				if (user.type === 'bot') {
					data.bot = true;
				}
				break;
			case 'userCreated':
				if (!user) {
					outgoingLogger.warn(`The integration ${event} was called but the owner was not defined.`);
					return;
				}
				data.timestamp = user.createdAt;
				data.user_id = user._id;
				data.user_name = user.username;
				data.user = userWithoutServicesField;

				if (user.type === 'bot') {
					data.bot = true;
				}
				break;
			default:
				break;
		}
	}

	getTriggersToExecute(room?: IRoom, message?: MessageWithEditedAt) {
		const triggersToExecute = new Set<IOutgoingIntegration>();
		if (room) {
			switch (room.t) {
				case 'd':
					if (this.triggers.all_direct_messages) {
						for (const trigger of Object.values(this.triggers.all_direct_messages)) {
							triggersToExecute.add(trigger);
						}
					}

					room.uids
						?.filter((uid) => this.triggers[`@${uid}`])
						.forEach((uid) => {
							for (const trigger of Object.values(this.triggers[`@${uid}`])) {
								triggersToExecute.add(trigger);
							}
						});

					room.usernames
						?.filter((username) => username !== message?.u?.username && this.triggers[`@${username}`])
						.forEach((username) => {
							for (const trigger of Object.values(this.triggers[`@${username}`])) {
								triggersToExecute.add(trigger);
							}
						});
					break;
				case 'c':
					if (this.triggers.all_public_channels) {
						for (const trigger of Object.values(this.triggers.all_public_channels)) {
							triggersToExecute.add(trigger);
						}
					}

					if (this.triggers[`#${room._id}`]) {
						for (const trigger of Object.values(this.triggers[`#${room._id}`])) {
							triggersToExecute.add(trigger);
						}
					}

					if (room._id !== room.name && this.triggers[`#${room.name}`]) {
						for (const trigger of Object.values(this.triggers[`#${room.name}`])) {
							triggersToExecute.add(trigger);
						}
					}
					break;

				default:
					if (this.triggers.all_private_groups) {
						for (const trigger of Object.values(this.triggers.all_private_groups)) {
							triggersToExecute.add(trigger);
						}
					}

					if (this.triggers[`#${room._id}`]) {
						for (const trigger of Object.values(this.triggers[`#${room._id}`])) {
							triggersToExecute.add(trigger);
						}
					}

					if (room._id !== room.name && this.triggers[`#${room.name}`]) {
						for (const trigger of Object.values(this.triggers[`#${room.name}`])) {
							triggersToExecute.add(trigger);
						}
					}
					break;
			}
		}
		return [...triggersToExecute];
	}

	async executeTriggers(...args: unknown[]) {
		outgoingLogger.debug({ msg: 'Execute Trigger:', arg: args[0] });

		const argObject = this.eventNameArgumentsToObject(...args);
		const { event, message, room } = argObject;

		// Each type of event should have an event and a room attached, otherwise we
		// wouldn't know how to handle the trigger nor would we have anywhere to send the
		// result of the integration
		if (!event) {
			return;
		}

		outgoingLogger.debug(`Starting search for triggers for the room: ${room ? room._id : '__any'}`);

		const triggersToExecute = this.getTriggersToExecute(room, message);

		if (this.triggers.__any) {
			// For outgoing integration which don't rely on rooms.
			for (const trigger of Object.values(this.triggers.__any)) {
				triggersToExecute.push(trigger);
			}
		}

		outgoingLogger.debug(`Found ${triggersToExecute.length} to iterate over and see if the match the event.`);

		for await (const triggerToExecute of triggersToExecute) {
			outgoingLogger.debug(
				`Is "${triggerToExecute.name}" enabled, ${triggerToExecute.enabled}, and what is the event? ${triggerToExecute.event}`,
			);
			if (triggerToExecute.enabled === true && triggerToExecute.event === event) {
				await this.executeTrigger(triggerToExecute, argObject);
			}
		}
	}

	async executeTrigger(trigger: IOutgoingIntegration, argObject: ArgumentsObject) {
		if (!trigger.urls) {
			return;
		}
		for await (const url of trigger.urls) {
			await this.executeTriggerUrl(url, trigger, argObject, 0);
		}
	}

	// Ensure that any errors thrown by the script engine will contibue to be compatible with Meteor.Error
	async wrapScriptEngineCall(getter: () => Promise<any>) {
		return wrapExceptions(getter).catch((error) => {
			if (error instanceof Error) {
				throw new Meteor.Error(error.message);
			}

			throw error;
		});
	}

	async executeTriggerUrl(url: string, trigger: IOutgoingIntegration, { event, message, room, owner, user }: ArgumentsObject, tries = 0) {
		if (!this.isTriggerEnabled(trigger)) {
			outgoingLogger.warn(`The trigger "${trigger.name}" is no longer enabled, stopping execution of it at try: ${tries}`);
			return;
		}

		outgoingLogger.debug(`Starting to execute trigger: ${trigger.name} (${trigger._id})`);

		let word;
		// Not all triggers/events support triggerWords
		if (event && outgoingEvents[event].use.triggerWords) {
			if (trigger.triggerWords && trigger.triggerWords.length > 0) {
				for (const triggerWord of trigger.triggerWords) {
					if (!trigger.triggerWordAnywhere && message?.msg.indexOf(triggerWord) === 0) {
						word = triggerWord;
						break;
					} else if (trigger.triggerWordAnywhere && message?.msg.includes(triggerWord)) {
						word = triggerWord;
						break;
					}
				}

				// Stop if there are triggerWords but none match
				if (!word) {
					outgoingLogger.debug(`The trigger word which "${trigger.name}" was expecting could not be found, not executing.`);
					return;
				}
			}
		}

		if (message && message.editedAt && !trigger.runOnEdits) {
			outgoingLogger.debug(`The trigger "${trigger.name}"'s run on edits is disabled and the message was edited.`);
			return;
		}

		const historyId = await updateHistory({
			step: 'start-execute-trigger-url',
			integration: trigger,
			event,
			historyId: '',
		});

		const data: IntegrationData = {
			token: trigger.token,
			bot: false,
		};

		if (word) {
			data.trigger_word = word;
		}

		this.mapEventArgsToData(data, { event, message, room, owner, user });
		await updateHistory({ historyId, step: 'mapped-args-to-data', data, triggerWord: word });

		outgoingLogger.info(`Will be executing the Integration "${trigger.name}" to the url: ${url}`);
		outgoingLogger.debug({ data });

		const scriptEngine = this.getEngine(trigger);

		const opts = await this.wrapScriptEngineCall(() =>
			scriptEngine.prepareOutgoingRequest({
				integration: trigger,
				data: data as OutgoingRequestData,
				url,
				historyId,
			}),
		);

		await updateHistory({ historyId, step: 'after-maybe-ran-prepare', ranPrepareScript: true });

		if (!opts) {
			await updateHistory({ historyId, step: 'after-prepare-no-opts', finished: true });
			return;
		}

		if (opts.message) {
			const prepareMessage = await this.sendMessage({ trigger, room, message: opts.message, data });
			if (!prepareMessage) {
				await updateHistory({ historyId, step: 'after-prepare-send-message-failed', finished: true });
				return;
			}
			await updateHistory({
				historyId,
				step: 'after-prepare-send-message',
				prepareSentMessage: prepareMessage,
			});
		}

		if (!opts.url || !opts.method) {
			await updateHistory({ historyId, step: 'after-prepare-no-url_or_method', finished: true });
			return;
		}

		// based on HTTP.call implementation
		if (opts.auth) {
			if (opts.auth.indexOf(':') < 0) {
				throw new Error('auth option should be of the form "username:password"');
			}

			const base64 = Buffer.from(opts.auth, 'ascii').toString('base64');
			opts.headers.Authorization = `Basic ${base64}`;
		}

		await updateHistory({
			historyId,
			step: 'pre-http-call',
			url: opts.url,
			httpCallData: opts.data,
		});

		if (opts.data) {
			opts.headers['Content-Type'] = 'application/json';
		}

		fetch(
			opts.url,
			{
				method: opts.method,
				headers: opts.headers,
				...(opts.timeout && { timeout: opts.timeout }),
				...(opts.data && { body: opts.data }),
			},
			settings.get('Allow_Invalid_SelfSigned_Certs'),
		)
			.then(async (res) => {
				const content = await res.text();
				if (!content) {
					outgoingLogger.warn(`Result for the Integration ${trigger.name} to ${url} is empty`);
				} else {
					outgoingLogger.info(`Status code for the Integration ${trigger.name} to ${url} is ${res.status}`);
				}

				const data = (() => {
					const contentType = (res.headers.get('content-type') || '').split(';')[0];
					if (!['application/json', 'text/javascript', 'application/javascript', 'application/x-javascript'].includes(contentType)) {
						return null;
					}

					try {
						return JSON.parse(content);
					} catch (_error) {
						return null;
					}
				})();

				await updateHistory({
					historyId,
					step: 'after-http-call',
					httpError: null,
					httpResult: content,
				});

				const responseContent = await this.wrapScriptEngineCall(() =>
					scriptEngine.processOutgoingResponse({
						integration: trigger,
						request: opts,
						response: res,
						content,
						historyId,
					}),
				);

				if (responseContent) {
					const resultMessage = await this.sendMessage({
						trigger,
						room,
						message: responseContent,
						data,
					});

					if (!resultMessage) {
						await updateHistory({ historyId, step: 'after-process-send-message-failed', finished: true });
						return;
					}

					await updateHistory({
						historyId,
						step: 'after-process-send-message',
						processSentMessage: resultMessage,
						finished: true,
					});
					return;
				}

				if (responseContent === false) {
					await updateHistory({ historyId, step: 'after-process-false-result', finished: true });
					return;
				}

				// if the result contained nothing or wasn't a successful statusCode
				if (!content || !this.successResults.includes(res.status)) {
					if (content) {
						outgoingLogger.error({
							msg: `Error for the Integration "${trigger.name}" to ${url}`,
							result: content,
						});

						if (res.status === 410) {
							await updateHistory({ historyId, step: 'after-process-http-status-410', error: true });
							outgoingLogger.error(`Disabling the Integration "${trigger.name}" because the status code was 401 (Gone).`);
							await Integrations.updateOne({ _id: trigger._id }, { $set: { enabled: false } });
							void notifyOnIntegrationChangedById(trigger._id);
							return;
						}

						if (res.status === 500) {
							await updateHistory({ historyId, step: 'after-process-http-status-500', error: true });
							outgoingLogger.error({
								msg: `Error "500" for the Integration "${trigger.name}" to ${url}.`,
								content,
							});
							return;
						}
					}

					if (trigger.retryFailedCalls && trigger.retryCount) {
						if (tries < trigger.retryCount && trigger.retryDelay) {
							await updateHistory({ historyId, error: true, step: `going-to-retry-${tries + 1}` });

							let waitTime;

							switch (trigger.retryDelay) {
								case 'powers-of-ten':
									// Try again in 0.1s, 1s, 10s, 1m40s, 16m40s, 2h46m40s, 27h46m40s, etc
									waitTime = Math.pow(10, tries + 2);
									break;
								case 'powers-of-two':
									// 2 seconds, 4 seconds, 8 seconds
									waitTime = Math.pow(2, tries + 1) * 1000;
									break;
								case 'increments-of-two':
									// 2 second, 4 seconds, 6 seconds, etc
									waitTime = (tries + 1) * 2 * 1000;
									break;
								default:
									const er = new Error("The integration's retryDelay setting is invalid.");
									await updateHistory({
										historyId,
										step: 'failed-and-retry-delay-is-invalid',
										error: true,
										errorStack: er.stack,
									});
									return;
							}

							outgoingLogger.info(`Trying the Integration ${trigger.name} to ${url} again in ${waitTime} milliseconds.`);
							setTimeout(() => {
								void this.executeTriggerUrl(url, trigger, { event, message, room, owner, user }, tries + 1);
							}, waitTime);
						} else {
							await updateHistory({ historyId, step: 'too-many-retries', error: true });
						}
					} else {
						await updateHistory({
							historyId,
							step: 'failed-and-not-configured-to-retry',
							error: true,
						});
					}

					return;
				}

				// process outgoing webhook response as a new message
				if (content && this.successResults.includes(res.status)) {
					if (data?.text || data?.attachments) {
						const resultMsg = await this.sendMessage({ trigger, room, message: data, data });
						if (!resultMsg) {
							await updateHistory({ historyId, step: 'after-http-call-send-message-failed', finished: true });
							return;
						}
						await updateHistory({
							historyId,
							step: 'url-response-sent-message',
							resultMessage: resultMsg,
							finished: true,
						});
					}
				}
			})
			.catch(async (error) => {
				outgoingLogger.error(error);
				await updateHistory({
					historyId,
					step: 'after-http-call',
					httpError: error,
					httpResult: null,
				});
			});
	}

	async replay(integration: IOutgoingIntegration, history: IIntegrationHistory) {
		if (!integration || integration.type !== 'webhook-outgoing') {
			throw new Meteor.Error('integration-type-must-be-outgoing', 'The integration type to replay must be an outgoing webhook.');
		}

		if (!history || !history.data) {
			throw new Meteor.Error('history-data-must-be-defined', 'The history data must be defined to replay an integration.');
		}

		const { event } = history;
		let owner;
		let message;
		let room;
		let user;

		if (history.data.owner && history.data.owner._id) {
			owner = await Users.findOneById(history.data.owner._id);
		}
		if (history.data.message_id) {
			message = await Messages.findOneById(history.data.message_id);
		}
		if (history.data.channel_id) {
			room = await Rooms.findOneById(history.data.channel_id);
		}
		if (history.data.user_id) {
			user = await Users.findOneById(history.data.user_id);
		}

		if (!history.url) {
			return;
		}

		return this.executeTriggerUrl(history.url, integration, {
			event,
			message: message || undefined,
			room: room || undefined,
			owner: owner || undefined,
			user: user || undefined,
		});
	}
}
const triggerHandler = new RocketChatIntegrationHandler();
export { triggerHandler };
