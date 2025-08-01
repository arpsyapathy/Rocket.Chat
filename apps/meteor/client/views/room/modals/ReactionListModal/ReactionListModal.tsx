import type { IMessage } from '@rocket.chat/core-typings';
import { GenericModal } from '@rocket.chat/ui-client';
import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';

import Reactions from './Reactions';

type ReactionListModalProps = {
	reactions: Required<IMessage>['reactions'];
	onClose: () => void;
};

const ReactionListModal = ({ reactions, onClose }: ReactionListModalProps): ReactElement => {
	const { t } = useTranslation();

	return (
		<GenericModal variant='info' title={t('Users_reacted')} onClose={onClose} onConfirm={onClose} confirmText={t('Close')}>
			<Reactions reactions={reactions} />
		</GenericModal>
	);
};

export default ReactionListModal;
