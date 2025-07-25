import { faker } from '@faker-js/faker';
import type { Page } from '@playwright/test';

import { BASE_API_URL, IS_EE } from './config/constants';
import { createAuxContext } from './fixtures/createAuxContext';
import injectInitialData from './fixtures/inject-initial-data';
import { Users, storeState, restoreState } from './fixtures/userStates';
import { AccountProfile, HomeChannel } from './page-objects';
import { AccountSecurityPage } from './page-objects/account-security';
import { EncryptedRoomPage } from './page-objects/encrypted-room';
import { HomeSidenav } from './page-objects/fragments';
import {
	E2EEKeyDecodeFailureBanner,
	EnterE2EEPasswordBanner,
	EnterE2EEPasswordModal,
	SaveE2EEPasswordBanner,
	SaveE2EEPasswordModal,
} from './page-objects/fragments/e2ee';
import { ExportMessagesTab } from './page-objects/fragments/export-messages-tab';
import { FileUploadModal } from './page-objects/fragments/file-upload-modal';
import { LoginPage } from './page-objects/login';
import { test, expect } from './utils/test';

test.beforeAll(async () => {
	await injectInitialData();
});

test.describe('initial setup', () => {
	test.use({ storageState: Users.admin.state });

	test.beforeAll(async ({ api }) => {
		await api.post('/settings/E2E_Enable', { value: true });
		await api.post('/settings/E2E_Allow_Unencrypted_Messages', { value: true });
	});

	test.afterAll(async ({ api }) => {
		await api.post('/settings/E2E_Enable', { value: false });
		await api.post('/settings/E2E_Allow_Unencrypted_Messages', { value: false });
	});

	test.beforeEach(async ({ api, page }) => {
		const loginPage = new LoginPage(page);

		await api.post('/method.call/e2e.resetOwnE2EKey', {
			message: JSON.stringify({ msg: 'method', id: '1', method: 'e2e.resetOwnE2EKey', params: [] }),
		});

		await page.goto('/home');
		await loginPage.waitForIt();
		await loginPage.loginByUserState(Users.admin);
	});

	test('expect the randomly generated password to work', async ({ page }) => {
		const loginPage = new LoginPage(page);
		const saveE2EEPasswordBanner = new SaveE2EEPasswordBanner(page);
		const saveE2EEPasswordModal = new SaveE2EEPasswordModal(page);
		const enterE2EEPasswordBanner = new EnterE2EEPasswordBanner(page);
		const enterE2EEPasswordModal = new EnterE2EEPasswordModal(page);
		const e2EEKeyDecodeFailureBanner = new E2EEKeyDecodeFailureBanner(page);
		const sidenav = new HomeSidenav(page);

		// Click the banner to open the dialog to save the generated password
		await saveE2EEPasswordBanner.click();
		const password = await saveE2EEPasswordModal.getPassword();
		await saveE2EEPasswordModal.confirm();
		await saveE2EEPasswordBanner.waitForDisappearance();

		// Log out
		await sidenav.logout();

		// Login again
		await loginPage.loginByUserState(Users.admin);

		// Enter the saved password
		await enterE2EEPasswordBanner.click();
		await enterE2EEPasswordModal.enterPassword(password);

		// No error banner
		await e2EEKeyDecodeFailureBanner.expectToNotBeVisible();
	});

	test('expect to manually reset the password', async ({ page }) => {
		const accountSecurityPage = new AccountSecurityPage(page);
		const loginPage = new LoginPage(page);

		// Reset the E2EE key to start the flow from the beginning
		await accountSecurityPage.goto();
		await accountSecurityPage.resetE2EEPassword();

		await loginPage.loginByUserState(Users.admin);
	});

	test('expect to manually set a new password', async ({ page }) => {
		const accountSecurityPage = new AccountSecurityPage(page);
		const loginPage = new LoginPage(page);
		const saveE2EEPasswordBanner = new SaveE2EEPasswordBanner(page);
		const saveE2EEPasswordModal = new SaveE2EEPasswordModal(page);
		const enterE2EEPasswordBanner = new EnterE2EEPasswordBanner(page);
		const enterE2EEPasswordModal = new EnterE2EEPasswordModal(page);
		const e2EEKeyDecodeFailureBanner = new E2EEKeyDecodeFailureBanner(page);
		const sidenav = new HomeSidenav(page);

		const newPassword = faker.string.uuid();

		// Click the banner to open the dialog to save the generated password
		await saveE2EEPasswordBanner.click();
		await saveE2EEPasswordModal.confirm();
		await saveE2EEPasswordBanner.waitForDisappearance();

		// Set a new password
		await accountSecurityPage.goto();
		await accountSecurityPage.setE2EEPassword(newPassword);
		await accountSecurityPage.close();

		// Log out
		await sidenav.logout();

		// Login again
		await loginPage.loginByUserState(Users.admin);

		// Enter the saved password
		await enterE2EEPasswordBanner.click();
		await enterE2EEPasswordModal.enterPassword(newPassword);

		// No error banner
		await e2EEKeyDecodeFailureBanner.expectToNotBeVisible();
	});
});

test.describe('basic features', () => {
	test.use({ storageState: Users.admin.state });

	test.beforeAll(async ({ api }) => {
		await api.post('/settings/E2E_Enable', { value: true });
		await api.post('/settings/E2E_Allow_Unencrypted_Messages', { value: true });
	});

	test.afterAll(async ({ api }) => {
		await api.post('/settings/E2E_Enable', { value: false });
		await api.post('/settings/E2E_Allow_Unencrypted_Messages', { value: false });
	});

	test.beforeEach(async ({ api, page }) => {
		const loginPage = new LoginPage(page);

		await api.post('/method.call/e2e.resetOwnE2EKey', {
			message: JSON.stringify({ msg: 'method', id: '1', method: 'e2e.resetOwnE2EKey', params: [] }),
		});

		await page.goto('/home');
		await loginPage.waitForIt();
		await loginPage.loginByUserState(Users.admin);
	});

	test('expect placeholder text in place of encrypted message', async ({ page }) => {
		const loginPage = new LoginPage(page);
		const saveE2EEPasswordBanner = new SaveE2EEPasswordBanner(page);
		const saveE2EEPasswordModal = new SaveE2EEPasswordModal(page);
		const encryptedRoomPage = new EncryptedRoomPage(page);
		const sidenav = new HomeSidenav(page);

		const channelName = faker.string.uuid();
		const messageText = 'This is an encrypted message.';

		await saveE2EEPasswordBanner.click();
		await saveE2EEPasswordModal.confirm();
		await saveE2EEPasswordBanner.waitForDisappearance();

		await sidenav.createEncryptedChannel(channelName);

		await expect(page).toHaveURL(`/group/${channelName}`);
		await expect(encryptedRoomPage.encryptedIcon).toBeVisible();
		await expect(encryptedRoomPage.encryptionNotReadyIndicator).not.toBeVisible();

		await encryptedRoomPage.sendMessage(messageText);
		await expect(encryptedRoomPage.lastMessage.encryptedIcon).toBeVisible();
		await expect(encryptedRoomPage.lastMessage.body).toHaveText(messageText);

		await sidenav.logout();

		await loginPage.loginByUserState(Users.admin);

		// Navigate to the encrypted channel WITHOUT entering the password

		await sidenav.openChat(channelName);
		await expect(encryptedRoomPage.encryptedIcon).toBeVisible();
		await expect(encryptedRoomPage.encryptionNotReadyIndicator).toBeVisible();

		await expect(encryptedRoomPage.lastMessage.encryptedIcon).toBeVisible();
		await expect(encryptedRoomPage.lastMessage.body).toHaveText(
			'This message is end-to-end encrypted. To view it, you must enter your encryption key in your account settings.',
		);
	});

	test('expect placeholder text in place of encrypted file upload description', async ({ page }) => {
		const encryptedRoomPage = new EncryptedRoomPage(page);
		const loginPage = new LoginPage(page);
		const saveE2EEPasswordBanner = new SaveE2EEPasswordBanner(page);
		const saveE2EEPasswordModal = new SaveE2EEPasswordModal(page);
		const fileUploadModal = new FileUploadModal(page);
		const sidenav = new HomeSidenav(page);

		const channelName = faker.string.uuid();
		const fileName = faker.system.commonFileName('txt');
		const fileDescription = faker.lorem.sentence();

		// Click the banner to open the dialog to save the generated password
		await saveE2EEPasswordBanner.click();
		await saveE2EEPasswordModal.confirm();
		await saveE2EEPasswordBanner.waitForDisappearance();

		// Create an encrypted channel
		await sidenav.createEncryptedChannel(channelName);

		await expect(page).toHaveURL(`/group/${channelName}`);
		await expect(encryptedRoomPage.encryptedIcon).toBeVisible();
		await expect(encryptedRoomPage.encryptionNotReadyIndicator).not.toBeVisible();

		await test.step('upload the file with encryption', async () => {
			// Upload a file
			await encryptedRoomPage.dragAndDropTxtFile();
			await fileUploadModal.setName(fileName);
			await fileUploadModal.setDescription(fileDescription);
			await fileUploadModal.send();

			// Check the file upload
			await expect(encryptedRoomPage.lastMessage.encryptedIcon).toBeVisible();
			await expect(encryptedRoomPage.lastMessage.fileUploadName).toContainText(fileName);
			await expect(encryptedRoomPage.lastMessage.body).toHaveText(fileDescription);
		});

		await test.step('disable encryption in the room', async () => {
			await encryptedRoomPage.disableEncryption();
			await expect(encryptedRoomPage.encryptedIcon).not.toBeVisible();
		});

		await test.step('upload the file without encryption', async () => {
			await encryptedRoomPage.dragAndDropTxtFile();
			await fileUploadModal.setName(fileName);
			await fileUploadModal.setDescription(fileDescription);
			await fileUploadModal.send();

			await expect(encryptedRoomPage.lastMessage.encryptedIcon).not.toBeVisible();
			await expect(encryptedRoomPage.lastMessage.fileUploadName).toContainText(fileName);
			await expect(encryptedRoomPage.lastMessage.body).toHaveText(fileDescription);
		});

		await test.step('enable encryption in the room', async () => {
			await encryptedRoomPage.enableEncryption();
			await expect(encryptedRoomPage.encryptedIcon).toBeVisible();
		});

		// Log out
		await sidenav.logout();

		// Login again
		await loginPage.loginByUserState(Users.admin);

		await sidenav.openChat(channelName);
		await expect(encryptedRoomPage.encryptedIcon).toBeVisible();

		await expect(encryptedRoomPage.lastNthMessage(1).body).toHaveText(
			'This message is end-to-end encrypted. To view it, you must enter your encryption key in your account settings.',
		);
		await expect(encryptedRoomPage.lastNthMessage(1).encryptedIcon).toBeVisible();

		await expect(encryptedRoomPage.lastMessage.encryptedIcon).not.toBeVisible();
		await expect(encryptedRoomPage.lastMessage.fileUploadName).toContainText(fileName);
		await expect(encryptedRoomPage.lastMessage.body).toHaveText(fileDescription);
	});

	test('should display only the download file method when exporting messages in an e2ee room', async ({ page }) => {
		const sidenav = new HomeSidenav(page);
		const encryptedRoomPage = new EncryptedRoomPage(page);
		const exportMessagesTab = new ExportMessagesTab(page);

		const channelName = faker.string.uuid();

		await sidenav.createEncryptedChannel(channelName);
		await expect(page).toHaveURL(`/group/${channelName}`);
		await expect(encryptedRoomPage.encryptedRoomHeaderIcon).toBeVisible();

		await encryptedRoomPage.showExportMessagesTab();
		await expect(exportMessagesTab.method).toContainClass('disabled'); // FIXME: looks like the component have an a11y issue
		await expect(exportMessagesTab.method).toHaveAccessibleName('Download file');
	});

	test('should allow exporting messages as PDF in an encrypted room', async ({ page }) => {
		const sidenav = new HomeSidenav(page);
		const encryptedRoomPage = new EncryptedRoomPage(page);
		const exportMessagesTab = new ExportMessagesTab(page);

		const channelName = faker.string.uuid();

		await sidenav.createEncryptedChannel(channelName);
		await expect(page).toHaveURL(`/group/${channelName}`);
		await expect(encryptedRoomPage.encryptedRoomHeaderIcon).toBeVisible();

		await encryptedRoomPage.sendMessage('This is a message to export as PDF.');
		await encryptedRoomPage.showExportMessagesTab();
		await expect(exportMessagesTab.method).toHaveAccessibleName('Download file');

		// Select Output format as PDF
		await exportMessagesTab.setOutputFormat('PDF');

		// select messages to be exported
		await exportMessagesTab.selectAllMessages();

		// Wait for download event and match format
		const download = await exportMessagesTab.downloadMessages();
		expect(download.suggestedFilename()).toMatch(/\.pdf$/);
	});
});

test.describe.serial('e2e-encryption', () => {
	let poHomeChannel: HomeChannel;

	test.use({ storageState: Users.userE2EE.state });

	test.beforeAll(async ({ api }) => {
		await api.post('/settings/E2E_Enable', { value: true });
		await api.post('/settings/E2E_Allow_Unencrypted_Messages', { value: true });
	});

	test.afterAll(async ({ api }) => {
		await api.post('/settings/E2E_Enable', { value: false });
		await api.post('/settings/E2E_Allow_Unencrypted_Messages', { value: false });
	});

	test.beforeEach(async ({ page }) => {
		poHomeChannel = new HomeChannel(page);
		await page.goto('/home');
	});

	test('expect create a private channel encrypted and send an encrypted message', async ({ page }) => {
		const channelName = faker.string.uuid();

		await poHomeChannel.sidenav.createEncryptedChannel(channelName);

		await expect(page).toHaveURL(`/group/${channelName}`);

		await expect(poHomeChannel.content.encryptedRoomHeaderIcon).toBeVisible();

		await poHomeChannel.content.sendMessage('hello world');

		await expect(poHomeChannel.content.lastUserMessageBody).toHaveText('hello world');
		await expect(poHomeChannel.content.lastUserMessage.locator('.rcx-icon--name-key')).toBeVisible();

		await poHomeChannel.tabs.kebab.click({ force: true });

		await expect(poHomeChannel.tabs.btnDisableE2E).toBeVisible();
		await poHomeChannel.tabs.btnDisableE2E.click({ force: true });
		await expect(page.getByRole('dialog', { name: 'Disable encryption' })).toBeVisible();
		await page.getByRole('button', { name: 'Disable encryption' }).click();
		await poHomeChannel.dismissToast();
		await page.waitForTimeout(1000);

		await poHomeChannel.content.sendMessage('hello world not encrypted');

		await expect(poHomeChannel.content.lastUserMessageBody).toHaveText('hello world not encrypted');
		await expect(poHomeChannel.content.lastUserMessage.locator('.rcx-icon--name-key')).not.toBeVisible();

		await poHomeChannel.tabs.kebab.click({ force: true });
		await expect(poHomeChannel.tabs.btnEnableE2E).toBeVisible();
		await poHomeChannel.tabs.btnEnableE2E.click({ force: true });
		await expect(page.getByRole('dialog', { name: 'Enable encryption' })).toBeVisible();
		await page.getByRole('button', { name: 'Enable encryption' }).click();
		await poHomeChannel.dismissToast();
		await page.waitForTimeout(1000);

		await poHomeChannel.content.sendMessage('hello world encrypted again');

		await expect(poHomeChannel.content.lastUserMessageBody).toHaveText('hello world encrypted again');
		await expect(poHomeChannel.content.lastUserMessage.locator('.rcx-icon--name-key')).toBeVisible();
	});

	test('expect create a private encrypted channel and send a encrypted thread message', async ({ page }) => {
		const channelName = faker.string.uuid();

		await poHomeChannel.sidenav.createEncryptedChannel(channelName);

		await expect(page).toHaveURL(`/group/${channelName}`);

		await expect(poHomeChannel.content.encryptedRoomHeaderIcon).toBeVisible();

		await poHomeChannel.content.sendMessage('This is the thread main message.');

		await expect(poHomeChannel.content.lastUserMessageBody).toHaveText('This is the thread main message.');
		await expect(poHomeChannel.content.lastUserMessage.locator('.rcx-icon--name-key')).toBeVisible();

		await page.locator('[data-qa-type="message"]').last().hover();
		await page.locator('role=button[name="Reply in thread"]').click();

		await expect(page).toHaveURL(/.*thread/);

		await expect(poHomeChannel.content.mainThreadMessageText).toContainText('This is the thread main message.');
		await expect(poHomeChannel.content.mainThreadMessageText.locator('.rcx-icon--name-key')).toBeVisible();

		await poHomeChannel.content.toggleAlsoSendThreadToChannel(true);
		await page.getByRole('dialog').locator('[name="msg"]').last().fill('This is an encrypted thread message also sent in channel');
		await page.keyboard.press('Enter');
		await expect(poHomeChannel.content.lastThreadMessageText).toContainText('This is an encrypted thread message also sent in channel');
		await expect(poHomeChannel.content.lastThreadMessageText.locator('.rcx-icon--name-key')).toBeVisible();
		await expect(poHomeChannel.content.lastUserMessage).toContainText('This is an encrypted thread message also sent in channel');
		await expect(poHomeChannel.content.mainThreadMessageText).toContainText('This is the thread main message.');
		await expect(poHomeChannel.content.mainThreadMessageText.locator('.rcx-icon--name-key')).toBeVisible();
	});

	test('expect create a private encrypted channel and check disabled message menu actions on an encrypted message', async ({ page }) => {
		const channelName = faker.string.uuid();

		await poHomeChannel.sidenav.createEncryptedChannel(channelName);

		await expect(page).toHaveURL(`/group/${channelName}`);

		await expect(poHomeChannel.content.encryptedRoomHeaderIcon).toBeVisible();

		await poHomeChannel.content.sendMessage('This is an encrypted message.');

		await expect(poHomeChannel.content.lastUserMessageBody).toHaveText('This is an encrypted message.');
		await expect(poHomeChannel.content.lastUserMessage.locator('.rcx-icon--name-key')).toBeVisible();

		await page.locator('[data-qa-type="message"]').last().hover();
		await expect(page.locator('role=button[name="Forward message not available on encrypted content"]')).toBeDisabled();

		await poHomeChannel.content.openLastMessageMenu();

		await expect(page.locator('role=menuitem[name="Reply in direct message"]')).toHaveClass(/disabled/);
		await expect(page.locator('role=menuitem[name="Copy link"]')).toHaveClass(/disabled/);
	});

	test('expect create a private channel, encrypt it and send an encrypted message', async ({ page }) => {
		const channelName = faker.string.uuid();

		await poHomeChannel.sidenav.openNewByLabel('Channel');
		await poHomeChannel.sidenav.inputChannelName.fill(channelName);
		await poHomeChannel.sidenav.btnCreate.click();

		await expect(page).toHaveURL(`/group/${channelName}`);

		await expect(poHomeChannel.toastSuccess).toBeVisible();

		await poHomeChannel.dismissToast();

		await poHomeChannel.tabs.kebab.click({ force: true });
		await expect(poHomeChannel.tabs.btnEnableE2E).toBeVisible();
		await poHomeChannel.tabs.btnEnableE2E.click({ force: true });
		await expect(page.getByRole('dialog', { name: 'Enable encryption' })).toBeVisible();
		await page.getByRole('button', { name: 'Enable encryption' }).click();
		await page.waitForTimeout(1000);

		await expect(poHomeChannel.content.encryptedRoomHeaderIcon).toBeVisible();

		await poHomeChannel.content.sendMessage('hello world');

		await expect(poHomeChannel.content.lastUserMessageBody).toHaveText('hello world');
		await expect(poHomeChannel.content.lastUserMessage.locator('.rcx-icon--name-key')).toBeVisible();
	});

	test('expect create a encrypted private channel and mention user', async ({ page }) => {
		const channelName = faker.string.uuid();

		await poHomeChannel.sidenav.createEncryptedChannel(channelName);

		await expect(page).toHaveURL(`/group/${channelName}`);

		await expect(poHomeChannel.content.encryptedRoomHeaderIcon).toBeVisible();

		await poHomeChannel.content.sendMessage('hello @user1');

		const userMention = await page.getByRole('button', {
			name: 'user1',
		});

		await expect(userMention).toBeVisible();
	});

	test('expect create a encrypted private channel, mention a channel and navigate to it', async ({ page }) => {
		const channelName = faker.string.uuid();

		await poHomeChannel.sidenav.createEncryptedChannel(channelName);

		await expect(page).toHaveURL(`/group/${channelName}`);

		await expect(poHomeChannel.content.encryptedRoomHeaderIcon).toBeVisible();

		await poHomeChannel.content.sendMessage('Are you in the #general channel?');

		const channelMention = await page.getByRole('button', {
			name: 'general',
		});

		await expect(channelMention).toBeVisible();

		await channelMention.click();

		await expect(page).toHaveURL(`/channel/general`);
	});

	test('expect create a encrypted private channel, mention a channel and user', async ({ page }) => {
		const channelName = faker.string.uuid();

		await poHomeChannel.sidenav.createEncryptedChannel(channelName);

		await expect(page).toHaveURL(`/group/${channelName}`);

		await expect(poHomeChannel.content.encryptedRoomHeaderIcon).toBeVisible();

		await poHomeChannel.content.sendMessage('Are you in the #general channel, @user1 ?');

		const channelMention = await page.getByRole('button', {
			name: 'general',
		});

		const userMention = await page.getByRole('button', {
			name: 'user1',
		});

		await expect(userMention).toBeVisible();
		await expect(channelMention).toBeVisible();
	});

	test('should encrypted field be available on edit room', async ({ page }) => {
		const channelName = faker.string.uuid();

		await poHomeChannel.sidenav.openNewByLabel('Channel');
		await poHomeChannel.sidenav.inputChannelName.fill(channelName);
		await poHomeChannel.sidenav.btnCreate.click();

		await expect(page).toHaveURL(`/group/${channelName}`);

		await expect(poHomeChannel.toastSuccess).toBeVisible();

		await poHomeChannel.dismissToast();

		await poHomeChannel.tabs.btnRoomInfo.click();
		await poHomeChannel.tabs.room.btnEdit.click();
		await poHomeChannel.tabs.room.advancedSettingsAccordion.click();

		await expect(poHomeChannel.tabs.room.checkboxEncrypted).toBeVisible();
	});

	test('expect create a Direct message, encrypt it and attempt to enable OTR', async ({ page }) => {
		await poHomeChannel.sidenav.openNewByLabel('Direct message');
		await poHomeChannel.sidenav.inputDirectUsername.click();
		await page.keyboard.type('user2');
		await page.waitForTimeout(1000);
		await page.keyboard.press('Enter');
		await poHomeChannel.sidenav.btnCreate.click();

		await expect(page).toHaveURL(`/direct/user2${Users.userE2EE.data.username}`);

		await poHomeChannel.tabs.kebab.click({ force: true });
		await expect(poHomeChannel.tabs.btnEnableE2E).toBeVisible();
		await poHomeChannel.tabs.btnEnableE2E.click({ force: true });
		await expect(page.getByRole('dialog', { name: 'Enable encryption' })).toBeVisible();
		await page.getByRole('button', { name: 'Enable encryption' }).click();
		await page.waitForTimeout(1000);

		await expect(poHomeChannel.content.encryptedRoomHeaderIcon).toBeVisible();

		await poHomeChannel.dismissToast();

		await poHomeChannel.tabs.kebab.click({ force: true });
		await expect(poHomeChannel.tabs.btnEnableOTR).toBeVisible();
		await poHomeChannel.tabs.btnEnableOTR.click({ force: true });

		await expect(page.getByText('OTR not available')).toBeVisible();
	});

	test.describe('File Encryption', async () => {
		test.afterAll(async ({ api }) => {
			await api.post('/settings/FileUpload_MediaTypeWhiteList', { value: '' });
			await api.post('/settings/FileUpload_MediaTypeBlackList', { value: 'image/svg+xml' });
		});

		test('File and description encryption', async ({ page }) => {
			await test.step('create an encrypted channel', async () => {
				const channelName = faker.string.uuid();

				await poHomeChannel.sidenav.openNewByLabel('Channel');
				await poHomeChannel.sidenav.inputChannelName.fill(channelName);
				await poHomeChannel.sidenav.advancedSettingsAccordion.click();
				await poHomeChannel.sidenav.checkboxEncryption.click();
				await poHomeChannel.sidenav.btnCreate.click();

				await expect(page).toHaveURL(`/group/${channelName}`);

				await poHomeChannel.dismissToast();

				await expect(poHomeChannel.content.encryptedRoomHeaderIcon).toBeVisible();
			});

			await test.step('send a file in channel', async () => {
				await poHomeChannel.content.dragAndDropTxtFile();
				await poHomeChannel.content.descriptionInput.fill('any_description');
				await poHomeChannel.content.fileNameInput.fill('any_file1.txt');
				await poHomeChannel.content.btnModalConfirm.click();

				await expect(poHomeChannel.content.lastUserMessage.locator('.rcx-icon--name-key')).toBeVisible();
				await expect(poHomeChannel.content.getFileDescription).toHaveText('any_description');
				await expect(poHomeChannel.content.lastMessageFileName).toContainText('any_file1.txt');
			});
		});

		test('File encryption with whitelisted and blacklisted media types', async ({ page, api }) => {
			await test.step('create an encrypted room', async () => {
				const channelName = faker.string.uuid();

				await poHomeChannel.sidenav.openNewByLabel('Channel');
				await poHomeChannel.sidenav.inputChannelName.fill(channelName);
				await poHomeChannel.sidenav.advancedSettingsAccordion.click();
				await poHomeChannel.sidenav.checkboxEncryption.click();
				await poHomeChannel.sidenav.btnCreate.click();

				await expect(page).toHaveURL(`/group/${channelName}`);

				await poHomeChannel.dismissToast();

				await expect(poHomeChannel.content.encryptedRoomHeaderIcon).toBeVisible();
			});

			await test.step('send a text file in channel', async () => {
				await poHomeChannel.content.dragAndDropTxtFile();
				await poHomeChannel.content.descriptionInput.fill('message 1');
				await poHomeChannel.content.fileNameInput.fill('any_file1.txt');
				await poHomeChannel.content.btnModalConfirm.click();

				await expect(poHomeChannel.content.lastUserMessage.locator('.rcx-icon--name-key')).toBeVisible();
				await expect(poHomeChannel.content.getFileDescription).toHaveText('message 1');
				await expect(poHomeChannel.content.lastMessageFileName).toContainText('any_file1.txt');
			});

			await test.step('set whitelisted media type setting', async () => {
				await api.post('/settings/FileUpload_MediaTypeWhiteList', { value: 'text/plain' });
			});

			await test.step('send text file again with whitelist setting set', async () => {
				await poHomeChannel.content.dragAndDropTxtFile();
				await poHomeChannel.content.descriptionInput.fill('message 2');
				await poHomeChannel.content.fileNameInput.fill('any_file2.txt');
				await poHomeChannel.content.btnModalConfirm.click();

				await expect(poHomeChannel.content.lastUserMessage.locator('.rcx-icon--name-key')).toBeVisible();
				await expect(poHomeChannel.content.getFileDescription).toHaveText('message 2');
				await expect(poHomeChannel.content.lastMessageFileName).toContainText('any_file2.txt');
			});

			await test.step('set blacklisted media type setting to not accept application/octet-stream media type', async () => {
				await api.post('/settings/FileUpload_MediaTypeBlackList', { value: 'application/octet-stream' });
			});

			await test.step('send text file again with blacklisted setting set, file upload should fail', async () => {
				await poHomeChannel.content.dragAndDropTxtFile();
				await poHomeChannel.content.descriptionInput.fill('message 3');
				await poHomeChannel.content.fileNameInput.fill('any_file3.txt');
				await poHomeChannel.content.btnModalConfirm.click();

				await expect(poHomeChannel.content.lastUserMessage.locator('.rcx-icon--name-key')).toBeVisible();
				await expect(poHomeChannel.content.getFileDescription).toHaveText('message 2');
				await expect(poHomeChannel.content.lastMessageFileName).toContainText('any_file2.txt');
			});
		});

		test.describe('File encryption setting disabled', async () => {
			test.beforeAll(async ({ api }) => {
				await api.post('/settings/E2E_Enable_Encrypt_Files', { value: false });
				await api.post('/settings/FileUpload_MediaTypeBlackList', { value: 'application/octet-stream' });
			});

			test.afterAll(async ({ api }) => {
				await api.post('/settings/E2E_Enable_Encrypt_Files', { value: true });
				await api.post('/settings/FileUpload_MediaTypeBlackList', { value: 'image/svg+xml' });
			});

			test('Upload file without encryption in e2ee room', async ({ page }) => {
				await test.step('create an encrypted channel', async () => {
					const channelName = faker.string.uuid();

					await poHomeChannel.sidenav.openNewByLabel('Channel');
					await poHomeChannel.sidenav.inputChannelName.fill(channelName);
					await poHomeChannel.sidenav.advancedSettingsAccordion.click();
					await poHomeChannel.sidenav.checkboxEncryption.click();
					await poHomeChannel.sidenav.btnCreate.click();

					await expect(page).toHaveURL(`/group/${channelName}`);

					await poHomeChannel.dismissToast();

					await expect(poHomeChannel.content.encryptedRoomHeaderIcon).toBeVisible();
				});

				await test.step('send a test encrypted message to check e2ee is working', async () => {
					await poHomeChannel.content.sendMessage('This is an encrypted message.');

					await expect(poHomeChannel.content.lastUserMessageBody).toHaveText('This is an encrypted message.');
					await expect(poHomeChannel.content.lastUserMessage.locator('.rcx-icon--name-key')).toBeVisible();
				});

				await test.step('send a text file in channel, file should not be encrypted', async () => {
					await poHomeChannel.content.dragAndDropTxtFile();
					await poHomeChannel.content.descriptionInput.fill('any_description');
					await poHomeChannel.content.fileNameInput.fill('any_file1.txt');
					await poHomeChannel.content.btnModalConfirm.click();

					await expect(poHomeChannel.content.lastUserMessage.locator('.rcx-icon--name-key')).not.toBeVisible();
					await expect(poHomeChannel.content.getFileDescription).toHaveText('any_description');
					await expect(poHomeChannel.content.lastMessageFileName).toContainText('any_file1.txt');
				});
			});
		});
	});

	test('expect slash commands to be enabled in an e2ee room', async ({ page }) => {
		test.skip(!IS_EE, 'Premium Only');
		const channelName = faker.string.uuid();

		await poHomeChannel.sidenav.createEncryptedChannel(channelName);

		await expect(page).toHaveURL(`/group/${channelName}`);

		await expect(poHomeChannel.content.encryptedRoomHeaderIcon).toBeVisible();

		await poHomeChannel.content.sendMessage('This is an encrypted message.');

		await expect(poHomeChannel.content.lastUserMessageBody).toHaveText('This is an encrypted message.');
		await expect(poHomeChannel.content.lastUserMessage.locator('.rcx-icon--name-key')).toBeVisible();

		await page.locator('[name="msg"]').type('/');
		await expect(page.locator('#popup-item-contextualbar')).not.toHaveClass(/disabled/);
		await page.locator('[name="msg"]').clear();

		await poHomeChannel.content.dispatchSlashCommand('/contextualbar');
		await expect(poHomeChannel.btnContextualbarClose).toBeVisible();

		await poHomeChannel.btnContextualbarClose.click();
		await expect(poHomeChannel.btnContextualbarClose).toBeHidden();
	});

	test.describe('un-encrypted messages not allowed in e2ee rooms', () => {
		test.skip(!IS_EE, 'Premium Only');
		let poHomeChannel: HomeChannel;

		test.beforeEach(async ({ page }) => {
			poHomeChannel = new HomeChannel(page);
			await page.goto('/home');
		});
		test.beforeAll(async ({ api }) => {
			await api.post('/settings/E2E_Allow_Unencrypted_Messages', { value: false });
		});

		test.afterAll(async ({ api }) => {
			await api.post('/settings/E2E_Allow_Unencrypted_Messages', { value: true });
		});

		test('expect slash commands to be disabled in an e2ee room', async ({ page }) => {
			const channelName = faker.string.uuid();

			await poHomeChannel.sidenav.createEncryptedChannel(channelName);

			await expect(page).toHaveURL(`/group/${channelName}`);

			await expect(poHomeChannel.content.encryptedRoomHeaderIcon).toBeVisible();

			await poHomeChannel.content.sendMessage('This is an encrypted message.');

			await expect(poHomeChannel.content.lastUserMessageBody).toHaveText('This is an encrypted message.');
			await expect(poHomeChannel.content.lastUserMessage.locator('.rcx-icon--name-key')).toBeVisible();

			await page.locator('[name="msg"]').pressSequentially('/');
			await expect(page.locator('#popup-item-contextualbar')).toHaveClass(/disabled/);
		});
	});

	test('expect create a private channel, send unecrypted messages, encrypt the channel and delete the last message and check the last message in the sidebar', async ({
		page,
	}) => {
		const channelName = faker.string.uuid();

		// Enable Sidebar Extended display mode
		await poHomeChannel.sidenav.setDisplayMode('Extended');

		// Create private channel
		await poHomeChannel.sidenav.openNewByLabel('Channel');
		await poHomeChannel.sidenav.inputChannelName.fill(channelName);
		await poHomeChannel.sidenav.btnCreate.click();
		await expect(page).toHaveURL(`/group/${channelName}`);
		await expect(poHomeChannel.toastSuccess).toBeVisible();
		await poHomeChannel.dismissToast();

		// Send Unencrypted Messages
		await poHomeChannel.content.sendMessage('first unencrypted message');
		await poHomeChannel.content.sendMessage('second unencrypted message');

		// Encrypt channel
		await poHomeChannel.tabs.kebab.click({ force: true });
		await expect(poHomeChannel.tabs.btnEnableE2E).toBeVisible();
		await poHomeChannel.tabs.btnEnableE2E.click({ force: true });
		await expect(page.getByRole('dialog', { name: 'Enable encryption' })).toBeVisible();
		await page.getByRole('button', { name: 'Enable encryption' }).click();
		await page.waitForTimeout(1000);
		await expect(poHomeChannel.content.encryptedRoomHeaderIcon).toBeVisible();

		// Send Encrypted Messages
		const encriptedMessage1 = 'first ENCRYPTED message';
		const encriptedMessage2 = 'second ENCRYPTED message';
		await poHomeChannel.content.sendMessage(encriptedMessage1);
		await poHomeChannel.content.sendMessage(encriptedMessage2);

		//  Delete last message
		await expect(poHomeChannel.content.lastUserMessageBody).toHaveText(encriptedMessage2);
		await poHomeChannel.content.openLastMessageMenu();
		await page.locator('role=menuitem[name="Delete"]').click();
		await page.locator('#modal-root .rcx-button-group--align-end .rcx-button--danger').click();

		// Check last message in the sidebar
		const sidebarChannel = await poHomeChannel.sidenav.getSidebarItemByName(channelName);
		await expect(sidebarChannel).toBeVisible();
		await expect(sidebarChannel.locator('span')).toContainText(encriptedMessage1);
	});

	test('expect create a private encrypted channel and pin/star an encrypted message', async ({ page }) => {
		const channelName = faker.string.uuid();

		await poHomeChannel.sidenav.createEncryptedChannel(channelName);

		await expect(page).toHaveURL(`/group/${channelName}`);

		await expect(poHomeChannel.content.encryptedRoomHeaderIcon).toBeVisible();

		await poHomeChannel.content.sendMessage('This message should be pinned and stared.');

		await expect(poHomeChannel.content.lastUserMessageBody).toHaveText('This message should be pinned and stared.');
		await expect(poHomeChannel.content.lastUserMessage.locator('.rcx-icon--name-key')).toBeVisible();

		await poHomeChannel.content.openLastMessageMenu();
		await page.locator('role=menuitem[name="Star"]').click();

		await expect(poHomeChannel.toastSuccess).toBeVisible();
		await poHomeChannel.dismissToast();

		await poHomeChannel.content.openLastMessageMenu();
		await page.locator('role=menuitem[name="Pin"]').click();
		await page.locator('#modal-root >> button:has-text("Yes, pin message")').click();

		await expect(poHomeChannel.toastSuccess).toBeVisible();
		await poHomeChannel.dismissToast();

		await poHomeChannel.tabs.kebab.click();
		await poHomeChannel.tabs.btnPinnedMessagesList.click();

		await expect(page.getByRole('dialog', { name: 'Pinned Messages' })).toBeVisible();

		const lastPinnedMessage = page.getByRole('dialog', { name: 'Pinned Messages' }).locator('[data-qa-type="message"]').last();
		await expect(lastPinnedMessage).toContainText('This message should be pinned and stared.');
		await lastPinnedMessage.hover();
		await lastPinnedMessage.locator('role=button[name="More"]').waitFor();
		await lastPinnedMessage.locator('role=button[name="More"]').click();
		await expect(page.locator('role=menuitem[name="Copy link"]')).toHaveClass(/disabled/);

		await poHomeChannel.btnContextualbarClose.click();

		await poHomeChannel.tabs.kebab.click();
		await poHomeChannel.tabs.btnStarredMessageList.click();

		const lastStarredMessage = page.getByRole('dialog', { name: 'Starred Messages' }).locator('[data-qa-type="message"]').last();
		await expect(page.getByRole('dialog', { name: 'Starred Messages' })).toBeVisible();
		await expect(lastStarredMessage).toContainText('This message should be pinned and stared.');
		await lastStarredMessage.hover();
		await lastStarredMessage.locator('role=button[name="More"]').waitFor();
		await lastStarredMessage.locator('role=button[name="More"]').click();
		await expect(page.locator('role=menuitem[name="Copy link"]')).toHaveClass(/disabled/);
	});

	test.describe('reset keys', () => {
		let anotherClientPage: Page;

		test.beforeEach(async ({ browser }) => {
			anotherClientPage = (await createAuxContext(browser, Users.userE2EE)).page;
		});

		test.afterEach(async () => {
			await anotherClientPage.close();
		});

		test('expect force logout on e2e keys reset', async ({ page }) => {
			const poAccountProfile = new AccountProfile(page);

			await page.goto('/account/security');

			await poAccountProfile.securityE2EEncryptionSection.click();
			await poAccountProfile.securityE2EEncryptionResetKeyButton.click();

			await expect(page.locator('role=button[name="Login"]')).toBeVisible();
			await expect(anotherClientPage.locator('role=button[name="Login"]')).toBeVisible();
		});
	});
});

test.use({ storageState: Users.admin.state });

test.describe.serial('e2ee room setup', () => {
	let poAccountProfile: AccountProfile;
	let poHomeChannel: HomeChannel;
	let e2eePassword: string;

	test.beforeEach(async ({ page }) => {
		poAccountProfile = new AccountProfile(page);
		poHomeChannel = new HomeChannel(page);
	});

	test.beforeAll(async ({ api }) => {
		await api.post('/settings/E2E_Enable', { value: true });
		await api.post('/settings/E2E_Allow_Unencrypted_Messages', { value: false });
	});

	test.afterAll(async ({ api }) => {
		await api.post('/settings/E2E_Enable', { value: false });
		await api.post('/settings/E2E_Allow_Unencrypted_Messages', { value: false });
	});

	test.afterEach(async ({ api }) => {
		await api.recreateContext();
	});

	test('expect save password state on encrypted room', async ({ page }) => {
		await page.goto('/account/security');
		await poAccountProfile.securityE2EEncryptionSection.click();
		await poAccountProfile.securityE2EEncryptionResetKeyButton.click();

		await page.locator('role=button[name="Login"]').waitFor();

		await injectInitialData();
		await restoreState(page, Users.admin);

		await page.goto('/home');

		await page.waitForSelector('#main-content');

		await expect(poHomeChannel.bannerSaveEncryptionPassword).toBeVisible();

		const channelName = faker.string.uuid();

		await poHomeChannel.sidenav.openNewByLabel('Channel');
		await poHomeChannel.sidenav.inputChannelName.fill(channelName);
		await poHomeChannel.sidenav.advancedSettingsAccordion.click();
		await poHomeChannel.sidenav.checkboxEncryption.click();
		await poHomeChannel.sidenav.btnCreate.click();

		await expect(page).toHaveURL(`/group/${channelName}`);

		await poHomeChannel.dismissToast();

		await expect(poHomeChannel.content.encryptedRoomHeaderIcon.first()).toBeVisible();
		await expect(poHomeChannel.btnRoomSaveE2EEPassword).toBeVisible();

		await poHomeChannel.tabs.btnE2EERoomSetupDisableE2E.waitFor();
		await expect(poHomeChannel.tabs.btnE2EERoomSetupDisableE2E).toBeVisible();
		await expect(poHomeChannel.tabs.btnTabMembers).toBeVisible();
		await expect(poHomeChannel.tabs.btnRoomInfo).toBeVisible();

		await expect(poHomeChannel.content.inputMessage).not.toBeVisible();

		await poHomeChannel.btnRoomSaveE2EEPassword.click();

		e2eePassword = (await page.evaluate(() => localStorage.getItem('e2e.randomPassword'))) || 'undefined';

		await expect(poHomeChannel.dialogSaveE2EEPassword).toBeVisible();
		await expect(poHomeChannel.dialogSaveE2EEPassword).toContainText(e2eePassword);

		await poHomeChannel.btnSavedMyPassword.click();

		await poHomeChannel.content.inputMessage.waitFor();

		await poHomeChannel.content.sendMessage('hello world');

		await expect(poHomeChannel.content.lastUserMessageBody).toHaveText('hello world');
		await expect(poHomeChannel.content.lastUserMessage.locator('.rcx-icon--name-key')).toBeVisible();
	});

	test('expect enter password state on encrypted room', async ({ page }) => {
		await page.goto('/home');

		// Logout to remove e2ee keys
		await poHomeChannel.sidenav.logout();

		await page.locator('role=button[name="Login"]').waitFor();

		await injectInitialData();
		await restoreState(page, Users.admin, { except: ['private_key', 'public_key'] });

		const channelName = faker.string.uuid();

		await poHomeChannel.sidenav.openNewByLabel('Channel');
		await poHomeChannel.sidenav.inputChannelName.fill(channelName);
		await poHomeChannel.sidenav.advancedSettingsAccordion.click();
		await poHomeChannel.sidenav.checkboxEncryption.click();
		await poHomeChannel.sidenav.btnCreate.click();

		await expect(page).toHaveURL(`/group/${channelName}`);

		await poHomeChannel.dismissToast();

		await expect(poHomeChannel.content.encryptedRoomHeaderIcon.first()).toBeVisible();

		await poHomeChannel.btnRoomEnterE2EEPassword.waitFor();

		await expect(poHomeChannel.btnRoomEnterE2EEPassword).toBeVisible();

		await poHomeChannel.tabs.btnE2EERoomSetupDisableE2E.waitFor();
		await expect(poHomeChannel.tabs.btnE2EERoomSetupDisableE2E).toBeVisible();
		await expect(poHomeChannel.tabs.btnTabMembers).toBeVisible();
		await expect(poHomeChannel.tabs.btnRoomInfo).toBeVisible();

		await expect(poHomeChannel.content.inputMessage).not.toBeVisible();

		await poHomeChannel.btnRoomEnterE2EEPassword.click();

		await page.locator('#modal-root input').fill(e2eePassword);

		await page.locator('#modal-root .rcx-button--primary').click();

		await expect(poHomeChannel.bannerEnterE2EEPassword).not.toBeVisible();

		await poHomeChannel.content.inputMessage.waitFor();
		// For E2EE to complete init setup
		await page.waitForTimeout(300);

		await poHomeChannel.content.sendMessage('hello world');

		await expect(poHomeChannel.content.lastUserMessageBody).toHaveText('hello world');
		await expect(poHomeChannel.content.lastUserMessage.locator('.rcx-icon--name-key')).toBeVisible();

		await storeState(page, Users.admin);
	});

	test('expect waiting for room keys state', async ({ page }) => {
		await page.goto('/home');

		const channelName = faker.string.uuid();

		await poHomeChannel.sidenav.openNewByLabel('Channel');
		await poHomeChannel.sidenav.inputChannelName.fill(channelName);
		await poHomeChannel.sidenav.advancedSettingsAccordion.click();
		await poHomeChannel.sidenav.checkboxEncryption.click();
		await poHomeChannel.sidenav.btnCreate.click();

		await expect(page).toHaveURL(`/group/${channelName}`);

		await poHomeChannel.dismissToast();

		await expect(poHomeChannel.content.encryptedRoomHeaderIcon.first()).toBeVisible();

		await poHomeChannel.content.sendMessage('hello world');

		await expect(poHomeChannel.content.lastUserMessageBody).toHaveText('hello world');
		await expect(poHomeChannel.content.lastUserMessage.locator('.rcx-icon--name-key')).toBeVisible();

		await poHomeChannel.sidenav.userProfileMenu.click();
		await poHomeChannel.sidenav.accountProfileOption.click();

		await page.locator('role=navigation >> a:has-text("Security")').click();

		await poAccountProfile.securityE2EEncryptionSection.click();
		await poAccountProfile.securityE2EEncryptionResetKeyButton.click();

		await page.locator('role=button[name="Login"]').waitFor();

		await page.reload();

		await page.locator('role=button[name="Login"]').waitFor();

		await injectInitialData();
		await restoreState(page, Users.admin);

		await page.locator('role=navigation >> role=button[name=Search]').click();
		await page.locator('role=search >> role=searchbox').fill(channelName);
		await page.locator(`role=search >> role=listbox >> role=link >> text="${channelName}"`).click();

		await poHomeChannel.btnRoomSaveE2EEPassword.click();
		await poHomeChannel.btnSavedMyPassword.click();

		await expect(poHomeChannel.content.inputMessage).not.toBeVisible();
		await expect(page.locator('.rcx-states__title')).toContainText('Check back later');

		await poHomeChannel.tabs.btnE2EERoomSetupDisableE2E.waitFor();
		await expect(poHomeChannel.tabs.btnE2EERoomSetupDisableE2E).toBeVisible();
		await expect(poHomeChannel.tabs.btnTabMembers).toBeVisible();
		await expect(poHomeChannel.tabs.btnRoomInfo).toBeVisible();
	});
});

test.describe('e2ee support legacy formats', () => {
	test.use({ storageState: Users.userE2EE.state });

	let poHomeChannel: HomeChannel;

	test.beforeEach(async ({ page }) => {
		poHomeChannel = new HomeChannel(page);
	});

	test.beforeAll(async ({ api }) => {
		await api.post('/settings/E2E_Enable', { value: true });
		await api.post('/settings/E2E_Allow_Unencrypted_Messages', { value: false });
	});

	test.afterAll(async ({ api }) => {
		await api.post('/settings/E2E_Enable', { value: false });
		await api.post('/settings/E2E_Allow_Unencrypted_Messages', { value: false });
	});

	//  ->>>>>>>>>>>Not testing upload since it was not implemented in the legacy format
	test('expect create a private channel encrypted and send an encrypted message', async ({ page, request }) => {
		await page.goto('/home');

		const channelName = faker.string.uuid();

		await poHomeChannel.sidenav.createEncryptedChannel(channelName);

		await expect(page).toHaveURL(`/group/${channelName}`);

		await expect(poHomeChannel.content.encryptedRoomHeaderIcon).toBeVisible();

		const rid = await page.locator('[data-qa-rc-room]').getAttribute('data-qa-rc-room');

		// send old format encrypted message via API
		const msg = await page.evaluate(async (rid) => {
			// eslint-disable-next-line import/no-unresolved, @typescript-eslint/no-var-requires, import/no-absolute-path
			const { e2e } = require('/app/e2e/client/rocketchat.e2e.ts');
			const e2eRoom = await e2e.getInstanceByRoomId(rid);
			return e2eRoom.encrypt({ _id: 'id', msg: 'Old format message' });
		}, rid);

		await request.post(`${BASE_API_URL}/chat.sendMessage`, {
			headers: {
				'X-Auth-Token': Users.userE2EE.data.loginToken,
				'X-User-Id': Users.userE2EE.data._id,
			},
			data: {
				message: {
					rid,
					msg,
					t: 'e2e',
				},
			},
		});

		await expect(poHomeChannel.content.lastUserMessageBody).toHaveText('Old format message');
		await expect(poHomeChannel.content.lastUserMessage.locator('.rcx-icon--name-key')).toBeVisible();
	});
});
