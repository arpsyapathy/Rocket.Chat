import { lazy, useMemo } from 'react';

import type { RoomToolboxActionConfig } from '../../views/room/contexts/RoomToolboxContext';

const ChatsContextualBar = lazy(() => import('../../views/omnichannel/directory/chats/ChatInfo/ChatsContextualBar'));

export const useRoomInfoRoomAction = () =>
	useMemo(
		(): RoomToolboxActionConfig => ({
			id: 'room-info',
			groups: ['live'],
			title: 'Room_Info',
			icon: 'info-circled',
			tabComponent: ChatsContextualBar,
			order: 0,
		}),
		[],
	);
