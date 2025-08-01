import type { ILivechatVisitor, IOmnichannelRoom } from '@rocket.chat/core-typings';
import { expect } from 'chai';
import { after, before, describe, it } from 'mocha';
import type { Response } from 'supertest';

import { getCredentials, api, request, credentials } from '../../../data/api-data';
import { createCustomField, deleteCustomField } from '../../../data/livechat/custom-fields';
import { closeOmnichannelRoom, createLivechatRoom, createVisitor, deleteVisitor, getLivechatRoomInfo } from '../../../data/livechat/rooms';
import { updatePermission, updateSetting } from '../../../data/permissions.helper';

describe('LIVECHAT - custom fields', () => {
	before((done) => getCredentials(done));

	before(async () => {
		await updateSetting('Livechat_enabled', true);
	});

	describe('livechat/custom-fields', () => {
		it('should return an "unauthorized error" when the user does not have the necessary permission', async () => {
			await updatePermission('view-l-room', []);
			await request.get(api('livechat/custom-fields')).set(credentials).expect('Content-Type', 'application/json').expect(403);
		});
		it('should return an array of custom fields', async () => {
			await updatePermission('view-l-room', ['admin']);
			await request
				.get(api('livechat/custom-fields'))
				.set(credentials)
				.expect('Content-Type', 'application/json')
				.expect(200)
				.expect((res: Response) => {
					expect(res.body).to.have.property('success', true);
					expect(res.body.customFields).to.be.an('array');
					expect(res.body).to.have.property('offset');
					expect(res.body).to.have.property('total');
					expect(res.body).to.have.property('count');
				});
		});
		it('should return an array of custom fields even requested with count and offset params', async () => {
			await updatePermission('view-l-room', ['admin']);
			await request
				.get(api('livechat/custom-fields'))
				.set(credentials)
				.query({
					count: 5,
					offset: 0,
				})
				.expect('Content-Type', 'application/json')
				.expect(200)
				.expect((res: Response) => {
					expect(res.body).to.have.property('success', true);
					expect(res.body.customFields).to.be.an('array');
					expect(res.body).to.have.property('offset');
					expect(res.body).to.have.property('total');
					expect(res.body).to.have.property('count');
				});
		});
	});

	describe('livechat/custom-fields/id', () => {
		it('should return an "unauthorized error" when the user does not have the necessary permission', async () => {
			await updatePermission('view-l-room', []);
			await request.get(api('livechat/custom-fields/invalid-id')).set(credentials).expect('Content-Type', 'application/json').expect(403);
			await updatePermission('view-l-room', ['admin']);
		});
	});

	describe('livechat/custom.field', () => {
		it('should fail when token is not on body params', async () => {
			await request.post(api('livechat/custom.field')).expect(400);
		});
		it('should fail when key is not on body params', async () => {
			await request.post(api('livechat/custom.field')).send({ token: 'invalid-token' }).expect(400);
		});
		it('should fail when value is not on body params', async () => {
			await request.post(api('livechat/custom.field')).send({ token: 'invalid-token', key: 'invalid-key' }).expect(400);
		});
		it('should fail when overwrite is not on body params', async () => {
			await request
				.post(api('livechat/custom.field'))
				.send({ token: 'invalid-token', key: 'invalid-key', value: 'invalid-value' })
				.expect(400);
		});
		it('should fail when token is invalid', async () => {
			await request
				.post(api('livechat/custom.field'))
				.send({ token: 'invalid-token', key: 'invalid-key', value: 'invalid-value', overwrite: true })
				.expect(400);
		});
		it('should fail when key is invalid', async () => {
			const visitor = await createVisitor();
			await request
				.post(api('livechat/custom.field'))
				.send({ token: visitor.token, key: 'invalid-key', value: 'invalid-value', overwrite: true })
				.expect(400);
		});
		it('should save a custom field on visitor', async () => {
			const visitor = await createVisitor();
			const customFieldName = `new_custom_field_${Date.now()}`;
			await createCustomField({
				searchable: true,
				field: customFieldName,
				label: customFieldName,
				defaultValue: 'test_default_address',
				scope: 'visitor',
				visibility: 'public',
				regexp: '',
			});

			const { body } = await request
				.post(api('livechat/custom.field'))
				.send({ token: visitor.token, key: customFieldName, value: 'test_address', overwrite: true })
				.expect(200);

			expect(body).to.have.property('success', true);
			expect(body).to.have.property('field');
			expect(body.field).to.have.property('value', 'test_address');
		});
	});

	describe('livechat/custom.fields', () => {
		const customFieldName = `new_custom_field_${Date.now()}_1`;
		const customFieldName2 = `new_custom_field_${Date.now()}_2`;
		const customFieldName3 = `new_custom_field_${Date.now()}_3`;
		const roomCustomField = `new_custom_field_${Date.now()}_4`;
		let visitor: ILivechatVisitor;
		let visitorRoom: IOmnichannelRoom;

		before(async () => {
			await createCustomField({
				searchable: true,
				field: customFieldName,
				label: customFieldName,
				defaultValue: 'test_default_address',
				scope: 'visitor',
				visibility: 'public',
				regexp: '',
			});
			await createCustomField({
				searchable: true,
				field: customFieldName2,
				label: customFieldName2,
				defaultValue: 'test_default_address',
				scope: 'visitor',
				visibility: 'public',
				regexp: '',
			});
			await createCustomField({
				searchable: true,
				field: customFieldName3,
				label: customFieldName3,
				defaultValue: 'test_default_address',
				scope: 'visitor',
				visibility: 'public',
				regexp: '',
			});
			await createCustomField({
				searchable: true,
				field: roomCustomField,
				label: roomCustomField,
				defaultValue: 'test_default_address',
				scope: 'room',
				visibility: 'public',
				regexp: '',
			});
			visitor = await createVisitor();
			// start a room for visitor2
			visitorRoom = await createLivechatRoom(visitor.token);
		});
		after(async () => {
			await Promise.all([
				deleteCustomField(customFieldName),
				deleteCustomField(customFieldName2),
				deleteCustomField(customFieldName3),
				deleteCustomField(roomCustomField),
				closeOmnichannelRoom(visitorRoom._id),
			]);
		});
		it('should fail when token is not on body params', async () => {
			await request.post(api('livechat/custom.fields')).expect(400);
		});
		it('should fail if customFields is not on body params', async () => {
			await request.post(api('livechat/custom.fields')).send({ token: 'invalid-token' }).expect(400);
		});
		it('should fail if customFields is not an array', async () => {
			await request
				.post(api('livechat/custom.fields'))
				.send({
					token: 'invalid-token',
					customFields: 'invalid-custom-fields',
				})
				.expect(400);
		});
		it('should fail if customFields is an empty array', async () => {
			await request.post(api('livechat/custom.fields')).send({ token: 'invalid-token', customFields: [] }).expect(400);
		});
		it('should fail if customFields is an array with invalid objects', async () => {
			await request
				.post(api('livechat/custom.fields'))
				.send({ token: 'invalid-token', customFields: [{}] })
				.expect(400);
		});
		it('should fail if token is not a valid token', async () => {
			await request
				.post(api('livechat/custom.fields'))
				.send({
					token: 'invalid-token',
					customFields: [{ key: 'invalid-key', value: 'invalid-value', overwrite: true }],
				})
				.expect(400);
		});
		it('should fail when customFields.key is invalid', async () => {
			const visitor = await createVisitor();
			await request
				.post(api('livechat/custom.fields'))
				.send({
					token: visitor.token,
					customFields: [{ key: 'invalid-key', value: 'invalid-value', overwrite: true }],
				})
				.expect(400);
		});
		it('should save a custom field on visitor', async () => {
			const visitor = await createVisitor();

			const { body } = await request
				.post(api('livechat/custom.fields'))
				.send({
					token: visitor.token,
					customFields: [{ key: customFieldName, value: 'test_address', overwrite: true }],
				})
				.expect(200);

			expect(body).to.have.property('success', true);
			expect(body).to.have.property('fields');
			expect(body.fields).to.be.an('array');
			expect(body.fields).to.have.lengthOf(1);
			expect(body.fields[0]).to.have.property('value', 'test_address');
		});
		it('should save multiple custom fields on a visitor', async () => {
			const visitor = await createVisitor();

			const { body } = await request
				.post(api('livechat/custom.fields'))
				.send({
					token: visitor.token,
					customFields: [
						{ key: customFieldName, value: 'test_address', overwrite: true },
						{ key: customFieldName2, value: 'test_address2', overwrite: true },
						{ key: customFieldName3, value: 'test_address3', overwrite: true },
					],
				})
				.expect(200);

			expect(body).to.have.property('success', true);
			expect(body).to.have.property('fields');
			expect(body.fields).to.be.an('array');
			expect(body.fields).to.have.lengthOf(3);
			expect(body.fields[0]).to.have.property('value', 'test_address');
			expect(body.fields[1]).to.have.property('value', 'test_address2');
			expect(body.fields[2]).to.have.property('value', 'test_address3');
		});
		it('should save multiple custom fields on contact when visitor already has custom fields and an update with multiple fields is issued', async () => {
			const { body } = await request
				.post(api('livechat/custom.fields'))
				.send({
					token: visitor.token,
					customFields: [{ key: customFieldName, value: 'test_address', overwrite: true }],
				})
				.expect(200);

			expect(body).to.have.property('success', true);
			expect(body).to.have.property('fields');
			expect(body.fields).to.be.an('array');
			expect(body.fields).to.have.lengthOf(1);
			expect(body.fields[0]).to.have.property('value', 'test_address');

			await request
				.post(api('livechat/custom.fields'))
				.send({
					token: visitor.token,
					customFields: [
						{ key: customFieldName2, value: 'test_address2', overwrite: true },
						{ key: customFieldName3, value: 'test_address3', overwrite: true },
					],
				})
				.expect(200);

			await request
				.get(api(`omnichannel/contacts.get`))
				.set(credentials)
				.query({ contactId: visitorRoom.contactId })
				.expect(200)
				.expect((res) => {
					expect(res.body).to.have.property('contact');
					expect(res.body.contact).to.have.property('customFields');
					expect(res.body.contact.customFields).to.have.property(customFieldName, 'test_address');
					expect(res.body.contact.customFields).to.have.property(customFieldName2, 'test_address2');
					expect(res.body.contact.customFields).to.have.property(customFieldName3, 'test_address3');
				});
		});
		it('should mark a conflict on a contact custom fields when overwrite is true and visitor already has the custom field set', async () => {
			await request
				.post(api('livechat/custom.fields'))
				.send({
					token: visitor.token,
					customFields: [{ key: customFieldName, value: 'test_address_conflict', overwrite: false }],
				})
				.expect(200);

			await request
				.get(api(`omnichannel/contacts.get`))
				.set(credentials)
				.query({ contactId: visitorRoom.contactId })
				.expect(200)
				.expect((res) => {
					expect(res.body).to.have.property('contact');
					expect(res.body.contact).to.have.property('customFields');
					expect(res.body.contact.customFields).to.have.property(customFieldName, 'test_address');
					expect(res.body.contact.customFields).to.have.property(customFieldName2, 'test_address2');
					expect(res.body.contact.customFields).to.have.property(customFieldName3, 'test_address3');
					expect(res.body.contact).to.have.property('conflictingFields').that.is.an('array');
					expect(res.body.contact.conflictingFields[0]).to.deep.equal({
						field: `customFields.${customFieldName}`,
						value: 'test_address_conflict',
					});
				});
		});
		it('should overwrite the contact custom field when overwrite is true', async () => {
			await request
				.post(api('livechat/custom.fields'))
				.send({
					token: visitor.token,
					customFields: [{ key: customFieldName2, value: 'test_new_add', overwrite: true }],
				})
				.expect(200);

			await request
				.get(api(`omnichannel/contacts.get`))
				.set(credentials)
				.query({ contactId: visitorRoom.contactId })
				.expect(200)
				.expect((res) => {
					expect(res.body).to.have.property('contact');
					expect(res.body.contact).to.have.property('customFields');
					expect(res.body.contact.customFields).to.have.property(customFieldName, 'test_address');
					expect(res.body.contact.customFields).to.have.property(customFieldName2, 'test_new_add');
					expect(res.body.contact.customFields).to.have.property(customFieldName3, 'test_address3');
					expect(res.body.contact).to.have.property('conflictingFields').that.is.an('array');
					expect(res.body.contact.conflictingFields[0]).to.deep.equal({
						field: `customFields.${customFieldName}`,
						value: 'test_address_conflict',
					});
				});
		});
		it('should save both room & vistor custom fields on one call', async () => {
			const visitor = await createVisitor();
			const room = await createLivechatRoom(visitor.token);

			await request
				.post(api('livechat/custom.fields'))
				.send({
					token: visitor.token,
					customFields: [
						{ key: customFieldName, value: 'test_address', overwrite: true },
						{ key: roomCustomField, value: 'test_address2', overwrite: true },
						{ key: customFieldName3, value: 'test_address3', overwrite: true },
					],
				})
				.expect(200);

			await request
				.get(api(`omnichannel/contacts.get`))
				.set(credentials)
				.query({ contactId: visitorRoom.contactId })
				.expect(200)
				.expect((res) => {
					expect(res.body).to.have.property('contact');
					expect(res.body.contact).to.have.property('customFields');
					expect(res.body.contact.customFields).to.have.property(customFieldName, 'test_address');
					expect(res.body.contact.customFields).to.have.property(customFieldName3, 'test_address3');
				});

			const roomInfo = await getLivechatRoomInfo(room._id);
			expect(roomInfo).to.have.property('livechatData').that.is.an('object');
			expect(roomInfo.livechatData).to.have.property(roomCustomField, 'test_address2');
		});
		it('should ignore a room custom field when room already has a value for it and overwrite is false', async () => {
			const visitor = await createVisitor();
			const room = await createLivechatRoom(visitor.token);

			await request
				.post(api('livechat/custom.fields'))
				.send({
					token: visitor.token,
					customFields: [{ key: roomCustomField, value: 'test_address2', overwrite: true }],
				})
				.expect(200);

			await request
				.post(api('livechat/custom.fields'))
				.send({
					token: visitor.token,
					customFields: [{ key: roomCustomField, value: 'test_value_overriden', overwrite: false }],
				})
				.expect(200);

			const roomInfo = await getLivechatRoomInfo(room._id);
			expect(roomInfo).to.have.property('livechatData').that.is.an('object');
			expect(roomInfo.livechatData).to.have.property(roomCustomField, 'test_address2');
		});
	});

	describe('livechat/custom.field [with Contacts]', () => {
		let visitor: ILivechatVisitor;
		let contactId: string;

		const customFieldName = `custom_field_${Date.now()}`;
		const customFieldValue = 'custom-field-value';

		before(async () => {
			await updatePermission('create-livechat-contact', ['admin']);
			await updatePermission('view-livechat-contact', ['admin']);

			// Create a Visitor
			visitor = await createVisitor();

			// Create a Contact and store id on var
			await request
				.post(api('omnichannel/contacts'))
				.set(credentials)
				.send({
					name: visitor.name,
					emails: [visitor.visitorEmails?.[0].address],
					phones: [visitor.phone?.[0].phoneNumber],
				})
				.expect(200)
				.expect((res: Response) => {
					expect(res.body).to.have.property('success', true);
					expect(res.body).to.have.property('contactId');

					contactId = res.body.contactId;
				});

			await request.get(api('livechat/room')).query({ token: visitor.token });

			// Create Custom Field
			await createCustomField({
				searchable: true,
				field: customFieldName,
				label: customFieldName,
				defaultValue: 'test_default_address',
				scope: 'visitor',
				visibility: 'public',
				regexp: '',
			});

			await createCustomField({
				searchable: true,
				field: `${customFieldName}_2`,
				label: `${customFieldName}_2`,
				defaultValue: 'test_default_address',
				scope: 'visitor',
				visibility: 'public',
				regexp: '',
			});
		});

		after(async () => {
			// TODO: add clean up for contacts, visitors, etc
			await Promise.all([
				deleteCustomField(customFieldName),
				deleteCustomField(`${customFieldName}_2`),
				deleteCustomField(`${customFieldName}_3`),
				deleteVisitor(visitor.token),
			]);
		});

		it('should save the custom field on Contact when available', async () => {
			// Save the custom field on Visitor/Contact
			await request
				.post(api('livechat/custom.field'))
				.send({ token: visitor.token, key: customFieldName, value: customFieldValue, overwrite: true })
				.expect(200)
				.expect((res: Response) => {
					expect(res.body).to.have.property('success', true);
				});

			// Fetch the visitor to validate custom fields are properly set.
			await request
				.get(api(`livechat/visitor/${visitor.token}`))
				.set(credentials)
				.expect(200)
				.expect((res: Response) => {
					expect(res.body).to.have.property('success', true);
					expect(res.body.visitor).to.have.property('livechatData');
					expect(res.body.visitor.livechatData).to.have.property(customFieldName, customFieldValue);
				});

			// Fetch the visitor's contact to validate custom fields are properly set.
			await request
				.get(api(`omnichannel/contacts.get`))
				.set(credentials)
				.query({ contactId })
				.expect(200)
				.expect((res: Response) => {
					expect(res.body).to.have.property('success', true);
					expect(res.body).to.have.property('contact');
					expect(res.body.contact).to.have.property('customFields');
					expect(res.body.contact.customFields).to.have.property(customFieldName, customFieldValue);
				});
		});

		it('Should save multiple custom fields on Contact when available', async () => {
			// Save the custom field on Visitor/Contact
			await request
				.post(api('livechat/custom.field'))
				.send({ token: visitor.token, key: customFieldName, value: customFieldValue, overwrite: true })
				.expect(200)
				.expect((res: Response) => {
					expect(res.body).to.have.property('success', true);
				});

			await request
				.post(api('livechat/custom.field'))
				.send({ token: visitor.token, key: `${customFieldName}_2`, value: customFieldValue, overwrite: true })
				.expect(200)
				.expect((res: Response) => {
					expect(res.body).to.have.property('success', true);
				});

			// Fetch the visitor to validate custom fields are properly set.
			await request
				.get(api(`livechat/visitor/${visitor.token}`))
				.set(credentials)
				.expect(200)
				.expect((res: Response) => {
					expect(res.body).to.have.property('success', true);
					expect(res.body.visitor).to.have.property('livechatData');
					expect(res.body.visitor.livechatData).to.have.property(customFieldName, customFieldValue);
					expect(res.body.visitor.livechatData).to.have.property(`${customFieldName}_2`, customFieldValue);
				});

			// Fetch the visitor's contact to validate custom fields are properly set.
			await request
				.get(api(`omnichannel/contacts.get`))
				.set(credentials)
				.query({ contactId })
				.expect(200)
				.expect((res: Response) => {
					expect(res.body).to.have.property('success', true);
					expect(res.body).to.have.property('contact');
					expect(res.body.contact).to.have.property('customFields');
					expect(res.body.contact.customFields).to.have.property(customFieldName, customFieldValue);
					expect(res.body.contact.customFields).to.have.property(`${customFieldName}_2`, customFieldValue);
				});
		});

		it('should add the custom field as conflict on Contact when overwrite is false', async () => {
			const conflictingFieldValue = 'conflicting-custom-field-value';

			// Save the custom field on Contact
			await request
				.post(api('livechat/custom.field'))
				.send({ token: visitor.token, key: customFieldName, value: conflictingFieldValue, overwrite: false })
				.expect(200)
				.expect((res: Response) => {
					expect(res.body).to.have.property('success', true);
				});

			// Fetch the visitor to validate custom fields are properly set.
			await request
				.get(api(`livechat/visitor/${visitor.token}`))
				.set(credentials)
				.expect(200)
				.expect((res: Response) => {
					expect(res.body).to.have.property('success', true);
					expect(res.body.visitor).to.have.property('livechatData');
					expect(res.body.visitor.livechatData).to.have.property(customFieldName, customFieldValue);
				});

			// Fetch the visitor's contact to validate custom fields are properly set.
			await request
				.get(api(`omnichannel/contacts.get`))
				.set(credentials)
				.query({ contactId })
				.expect(200)
				.expect((res: Response) => {
					expect(res.body).to.have.property('success', true);
					expect(res.body).to.have.property('contact');
					expect(res.body.contact).to.have.property('customFields');
					expect(res.body.contact.customFields).to.have.property(customFieldName, customFieldValue);

					// Validate custom fields contain both entries, indicating conflict criteria
					expect(res.body.contact.conflictingFields).to.have.lengthOf(1);
					expect(res.body.contact.conflictingFields[0]).to.have.property('field', `customFields.${customFieldName}`);
					expect(res.body.contact.conflictingFields[0]).to.have.property('value', conflictingFieldValue);
				});
		});

		it('should not save the custom field as a conflict on Contact when overwrite is false but custom field is not registered yet', async () => {
			await createCustomField({
				searchable: true,
				field: `${customFieldName}_3`,
				label: `${customFieldName}_3`,
				defaultValue: 'test_default_address',
				scope: 'visitor',
				visibility: 'public',
				regexp: '',
			});

			// Save the custom field on Contact
			await request
				.post(api('livechat/custom.field'))
				.send({ token: visitor.token, key: `${customFieldName}_3`, value: customFieldValue, overwrite: false })
				.expect(200)
				.expect((res: Response) => {
					expect(res.body).to.have.property('success', true);
				});

			// Fetch the visitor to validate custom fields are properly set.
			await request
				.get(api(`livechat/visitor/${visitor.token}`))
				.set(credentials)
				.expect(200)
				.expect((res: Response) => {
					expect(res.body).to.have.property('success', true);
					expect(res.body.visitor).to.have.property('livechatData');
					expect(res.body.visitor.livechatData).to.have.property(`${customFieldName}_3`, customFieldValue);
				});

			// Fetch the visitor's contact to validate custom fields are properly set.
			await request
				.get(api(`omnichannel/contacts.get`))
				.set(credentials)
				.query({ contactId })
				.expect(200)
				.expect((res: Response) => {
					expect(res.body).to.have.property('success', true);
					expect(res.body).to.have.property('contact');
					expect(res.body.contact).to.have.property('customFields');
					expect(res.body.contact.customFields).to.have.property(`${customFieldName}_3`, customFieldValue);

					// Validate custom fields contain both entries, indicating conflict criteria
					expect(res.body.contact.conflictingFields).to.have.lengthOf(1);
					expect(res.body.contact.conflictingFields[0]).to.not.have.property('field', `customFields.${customFieldName}_3`);
				});
		});

		it('should not save contact conflictingFields as nullish if not modified', async () => {
			// Create a Visitor
			const visitor2 = await createVisitor();
			let contactId2: string | undefined;

			// Create a Contact and store id on var
			await request
				.post(api('omnichannel/contacts'))
				.set(credentials)
				.send({
					name: visitor2.name,
					emails: [visitor2.visitorEmails?.[0].address],
					phones: [visitor2.phone?.[0].phoneNumber],
				})
				.expect(200)
				.expect((res: Response) => {
					expect(res.body).to.have.property('success', true);
					expect(res.body).to.have.property('contactId');

					contactId2 = res.body.contactId;
				});

			await request.get(api('livechat/room')).query({ token: visitor2.token });

			// Save the custom field on Contact
			await request
				.post(api('livechat/custom.field'))
				.send({ token: visitor2.token, key: `${customFieldName}`, value: customFieldValue, overwrite: true })
				.expect(200)
				.expect((res: Response) => {
					expect(res.body).to.have.property('success', true);
				});

			// Fetch the visitor's contact to validate custom fields are properly set.
			await request
				.get(api(`omnichannel/contacts.get`))
				.set(credentials)
				.query({ contactId: contactId2 })
				.expect(200)
				.expect((res: Response) => {
					expect(res.body).to.have.property('success', true);
					expect(res.body).to.have.property('contact');
					expect(res.body.contact).to.have.property('customFields');
					expect(res.body.contact.customFields).to.have.property(`${customFieldName}`, customFieldValue);

					// Validate conflictingFields was not saved as null
					expect(res.body.contact).to.not.have.property('conflictingFields');
				});

			await deleteVisitor(visitor2.token);
		});

		it('should not save contact conflictingFields as nullish if not modified (through visitor update)', async () => {
			// Create a Visitor
			const visitor2 = await createVisitor();
			let contactId2: string | undefined;

			// Create a Contact and store id on var
			await request
				.post(api('omnichannel/contacts'))
				.set(credentials)
				.send({
					name: visitor2.name,
					emails: [visitor2.visitorEmails?.[0].address],
					phones: [visitor2.phone?.[0].phoneNumber],
				})
				.expect(200)
				.expect((res: Response) => {
					expect(res.body).to.have.property('success', true);
					expect(res.body).to.have.property('contactId');

					contactId2 = res.body.contactId;
				});

			await request.get(api('livechat/room')).query({ token: visitor2.token });

			// Save the custom field on Contact
			await request
				.post(api('livechat/visitor'))
				.set(credentials)
				.send({
					visitor: {
						token: visitor2.token,
						customFields: [{ key: `${customFieldName}`, value: customFieldValue, overwrite: true }],
					},
				});

			// Fetch the visitor's contact to validate custom fields are properly set.
			await request
				.get(api(`omnichannel/contacts.get`))
				.set(credentials)
				.query({ contactId: contactId2 })
				.expect(200)
				.expect((res: Response) => {
					expect(res.body).to.have.property('success', true);
					expect(res.body).to.have.property('contact');
					expect(res.body.contact).to.have.property('customFields');
					expect(res.body.contact.customFields).to.have.property(`${customFieldName}`, customFieldValue);

					// Validate conflictingFields was not saved as null
					expect(res.body.contact).to.not.have.property('conflictingFields');
				});

			await deleteVisitor(visitor2.token);
		});
	});
});
