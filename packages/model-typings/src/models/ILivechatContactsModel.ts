import type {
	AtLeast,
	ILivechatContact,
	ILivechatContactChannel,
	ILivechatContactVisitorAssociation,
	ILivechatVisitor,
} from '@rocket.chat/core-typings';
import type {
	AggregationCursor,
	Document,
	FindCursor,
	FindOneAndUpdateOptions,
	FindOptions,
	UpdateFilter,
	UpdateOptions,
	UpdateResult,
} from 'mongodb';

import type { Updater } from '../updater';
import type { FindPaginated, IBaseModel, InsertionModel } from './IBaseModel';

export interface ILivechatContactsModel extends IBaseModel<ILivechatContact> {
	insertContact(
		data: InsertionModel<Omit<ILivechatContact, 'createdAt'>> & { createdAt?: ILivechatContact['createdAt'] },
	): Promise<ILivechatContact['_id']>;
	updateContact(contactId: string, data: Partial<ILivechatContact>, options?: FindOneAndUpdateOptions): Promise<ILivechatContact>;
	updateById(contactId: string, update: UpdateFilter<ILivechatContact>, options?: UpdateOptions): Promise<Document | UpdateResult>;
	updateContactCustomFields(contactId: string, data: Partial<ILivechatContact>, options?: UpdateOptions): Promise<ILivechatContact | null>;
	addChannel(contactId: string, channel: ILivechatContactChannel): Promise<void>;
	findPaginatedContacts(
		search: { searchText?: string; unknown?: boolean },
		options?: FindOptions<ILivechatContact>,
	): FindPaginated<FindCursor<ILivechatContact>>;
	updateLastChatById(
		contactId: string,
		visitor: ILivechatContactVisitorAssociation,
		lastChat: ILivechatContact['lastChat'],
	): Promise<UpdateResult>;
	findContactMatchingVisitor(visitor: AtLeast<ILivechatVisitor, 'visitorEmails' | 'phone'>): Promise<ILivechatContact | null>;
	findContactByEmailAndContactManager(email: string): Promise<Pick<ILivechatContact, 'contactManager'> | null>;
	findOneByVisitor<T extends Document = ILivechatContact>(
		visitor: ILivechatContactVisitorAssociation,
		options?: FindOptions<ILivechatContact>,
	): Promise<T | null>;
	isChannelBlocked(visitor: ILivechatContactVisitorAssociation): Promise<boolean>;
	updateFromUpdaterByAssociation(
		visitor: ILivechatContactVisitorAssociation,
		contactUpdater: Updater<ILivechatContact>,
		options?: UpdateOptions,
	): Promise<UpdateResult>;
	findSimilarVerifiedContacts(
		channel: Pick<ILivechatContactChannel, 'field' | 'value'>,
		originalContactId: string,
		options?: FindOptions<ILivechatContact>,
	): Promise<ILivechatContact[]>;
	findAllByVisitorId(visitorId: string): FindCursor<ILivechatContact>;
	addEmail(contactId: string, email: string): Promise<ILivechatContact | null>;
	isContactActiveOnPeriod(visitor: ILivechatContactVisitorAssociation, period: string): Promise<number>;
	markContactActiveForPeriod(visitor: ILivechatContactVisitorAssociation, period: string): Promise<UpdateResult>;
	countContactsOnPeriod(period: string): Promise<number>;
	setChannelBlockStatus(visitor: ILivechatContactVisitorAssociation, blocked: boolean): Promise<UpdateResult>;
	setChannelVerifiedStatus(visitor: ILivechatContactVisitorAssociation, verified: boolean): Promise<UpdateResult>;
	setVerifiedUpdateQuery(verified: boolean, contactUpdater: Updater<ILivechatContact>): Updater<ILivechatContact>;
	setFieldAndValueUpdateQuery(field: string, value: string, contactUpdater: Updater<ILivechatContact>): Updater<ILivechatContact>;
	countByContactInfo({ contactId, email, phone }: { contactId?: string; email?: string; phone?: string }): Promise<number>;
	countUnknown(): Promise<number>;
	countBlocked(): Promise<number>;
	countFullyBlocked(): Promise<number>;
	countVerified(): Promise<number>;
	countContactsWithoutChannels(): Promise<number>;
	getStatistics(): AggregationCursor<{ totalConflicts: number; avgChannelsPerContact: number }>;
	updateByVisitorId(visitorId: string, update: UpdateFilter<ILivechatContact>, options?: UpdateOptions): Promise<UpdateResult>;
	disableByVisitorId(visitorId: string): Promise<UpdateResult | Document>;
	findOneEnabledById(_id: ILivechatContact['_id'], options?: FindOptions<ILivechatContact>): Promise<ILivechatContact | null>;
	findOneEnabledById<P extends Document = ILivechatContact>(_id: P['_id'], options?: FindOptions<P>): Promise<P | null>;
	findOneEnabledById(_id: ILivechatContact['_id'], options?: any): Promise<ILivechatContact | null>;
}
