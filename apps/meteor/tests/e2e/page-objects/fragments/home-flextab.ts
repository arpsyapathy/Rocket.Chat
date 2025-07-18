import type { Locator, Page } from '@playwright/test';

import { ExportMessagesTab } from './export-messages-tab';
import { HomeFlextabChannels } from './home-flextab-channels';
import { HomeFlextabMembers } from './home-flextab-members';
import { HomeFlextabNotificationPreferences } from './home-flextab-notificationPreferences';
import { HomeFlextabOtr } from './home-flextab-otr';
import { HomeFlextabPruneMessages } from './home-flextab-pruneMessages';
import { HomeFlextabRoom } from './home-flextab-room';

export class HomeFlextab {
	private readonly page: Page;

	readonly members: HomeFlextabMembers;

	readonly room: HomeFlextabRoom;

	readonly channels: HomeFlextabChannels;

	readonly notificationPreferences: HomeFlextabNotificationPreferences;

	readonly otr: HomeFlextabOtr;

	readonly exportMessages: ExportMessagesTab;

	readonly pruneMessages: HomeFlextabPruneMessages;

	constructor(page: Page) {
		this.page = page;
		this.members = new HomeFlextabMembers(page);
		this.room = new HomeFlextabRoom(page);
		this.channels = new HomeFlextabChannels(page);
		this.notificationPreferences = new HomeFlextabNotificationPreferences(page);
		this.otr = new HomeFlextabOtr(page);
		this.exportMessages = new ExportMessagesTab(page);
		this.pruneMessages = new HomeFlextabPruneMessages(page);
	}

	get toolbarPrimaryActions(): Locator {
		return this.page.getByRole('toolbar', { name: 'Primary Room actions' });
	}

	get btnTabMembers(): Locator {
		return this.page.locator('[data-qa-id=ToolBoxAction-members]');
	}

	get btnRoomInfo(): Locator {
		return this.page.locator('[data-qa-id=ToolBoxAction-info-circled]');
	}

	get btnChannels(): Locator {
		return this.page.locator('[data-qa-id="ToolBoxAction-hash"]');
	}

	get btnTeamMembers(): Locator {
		return this.page.locator('role=menuitem[name="Teams Members"]');
	}

	get kebab(): Locator {
		return this.toolbarPrimaryActions.locator('role=button[name="Options"]');
	}

	get btnNotificationPreferences(): Locator {
		return this.page.locator('role=menuitem[name="Notifications Preferences"]');
	}

	get btnExportMessages(): Locator {
		return this.page.locator('role=menuitem[name="Export messages"]');
	}

	get btnPruneMessages(): Locator {
		return this.page.getByRole('menuitem', { name: 'Prune Messages' });
	}

	get btnE2EERoomSetupDisableE2E(): Locator {
		return this.page.locator('[data-qa-id=ToolBoxAction-key]');
	}

	get btnDisableE2E(): Locator {
		return this.page.locator('role=menuitem[name="Disable E2E"]');
	}

	get btnEnableE2E(): Locator {
		return this.page.locator('role=menuitem[name="Enable E2E"]');
	}

	get btnEnableOTR(): Locator {
		return this.page.locator('role=menuitem[name="OTR"]');
	}

	get flexTabViewThreadMessage(): Locator {
		return this.page.locator('div.thread-list ul.thread [data-qa-type="message"]').last().locator('[data-qa-type="message-body"]');
	}

	get userInfoUsername(): Locator {
		return this.page.locator('[data-qa="UserInfoUserName"]');
	}

	get btnPinnedMessagesList(): Locator {
		return this.page.locator('[data-key="pinned-messages"]');
	}

	get btnStarredMessageList(): Locator {
		return this.page.locator('[data-key="starred-messages"]');
	}
}
