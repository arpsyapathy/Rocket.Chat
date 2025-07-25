import {
	Button,
	Field,
	FieldHint,
	FieldLabel,
	FieldRow,
	Modal,
	ModalClose,
	ModalContent,
	ModalFooter,
	ModalFooterControllers,
	ModalHeader,
	ModalIcon,
	ModalTitle,
} from '@rocket.chat/fuselage';
import { UserAutoComplete } from '@rocket.chat/ui-client';
import { useEndpoint, useUser } from '@rocket.chat/ui-contexts';
import { useQuery } from '@tanstack/react-query';
import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';

type VoipTransferModalProps = {
	extension: string;
	isLoading?: boolean;
	onCancel(): void;
	onConfirm(params: { extension: string; name: string | undefined }): void;
};

const VoipTransferModal = ({ extension, isLoading = false, onCancel, onConfirm }: VoipTransferModalProps) => {
	const { t } = useTranslation();
	const [username, setTransferTo] = useState('');
	const user = useUser();
	const transferToId = useId();
	const modalId = useId();

	const getUserInfo = useEndpoint('GET', '/v1/users.info');
	const { data: targetUser, isLoading: isTargetInfoLoading } = useQuery({
		queryKey: ['/v1/users.info', username],
		queryFn: () => getUserInfo({ username }),
		enabled: Boolean(username),
		select: (data) => data?.user || {},
	});

	const handleConfirm = () => {
		if (!targetUser?.freeSwitchExtension) {
			return;
		}

		onConfirm({ extension: targetUser.freeSwitchExtension, name: targetUser.name });
	};

	return (
		<Modal open aria-labelledby={modalId}>
			<ModalHeader>
				<ModalIcon color='danger' name='modal-warning' />
				<ModalTitle id={modalId}>{t('Transfer_call')}</ModalTitle>
				<ModalClose aria-label={t('Close')} onClick={onCancel} />
			</ModalHeader>
			<ModalContent>
				<Field>
					<FieldLabel htmlFor={transferToId}>{t('Transfer_to')}</FieldLabel>
					<FieldRow>
						<UserAutoComplete
							id={transferToId}
							value={username}
							aria-describedby={`${transferToId}-hint`}
							data-testid='vc-input-transfer-to'
							onChange={(target) => setTransferTo(target as string)}
							multiple={false}
							conditions={{
								freeSwitchExtension: { $exists: true, $ne: extension },
								username: { $ne: user?.username },
							}}
						/>
					</FieldRow>
					<FieldHint id={`${transferToId}-hint`}>{t('Select_someone_to_transfer_the_call_to')}</FieldHint>
				</Field>
			</ModalContent>
			<ModalFooter>
				<ModalFooterControllers>
					<Button data-testid='vc-button-cancel' secondary onClick={onCancel}>
						{t('Cancel')}
					</Button>
					<Button danger onClick={handleConfirm} disabled={!targetUser?.freeSwitchExtension} loading={isLoading || isTargetInfoLoading}>
						{t('Hang_up_and_transfer_call')}
					</Button>
				</ModalFooterControllers>
			</ModalFooter>
		</Modal>
	);
};

export default VoipTransferModal;
