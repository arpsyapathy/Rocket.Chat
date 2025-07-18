import { css } from '@rocket.chat/css-in-js';
import {
	Field,
	FieldError,
	Modal,
	IconButton,
	ModalHeader,
	ModalTitle,
	ModalClose,
	ModalContent,
	ModalFooter,
} from '@rocket.chat/fuselage';
import type { ReactElement } from 'react';

import { DialInput } from './DialInput';
import Pad from './Pad';
import { useDialPad } from './hooks/useDialPad';
import { useEnterKey } from './hooks/useEnterKey';

type DialPadModalProps = {
	initialValue?: string;
	errorMessage?: string;
	handleClose: () => void;
};

const callButtonStyle = css`
	> i {
		font-size: 32px !important;
	}
`;

const DialPadModal = ({ initialValue, errorMessage: initialErrorMessage, handleClose }: DialPadModalProps): ReactElement => {
	const {
		inputName,
		inputRef,
		inputError,
		isButtonDisabled,
		handleOnChange,
		handleBackspaceClick,
		handlePadButtonClick,
		handlePadButtonLongPressed,
		handleCallButtonClick,
	} = useDialPad({ initialValue, initialErrorMessage });

	useEnterKey(handleCallButtonClick, isButtonDisabled);

	return (
		<Modal width='432px'>
			<ModalHeader>
				<ModalTitle />
				<ModalClose onClick={handleClose} />
			</ModalHeader>
			<ModalContent display='flex' justifyContent='center' flexDirection='column'>
				<Field>
					<DialInput
						ref={inputRef}
						inputName={inputName}
						inputError={inputError}
						handleBackspaceClick={handleBackspaceClick}
						isButtonDisabled={isButtonDisabled}
						handleOnChange={handleOnChange}
					/>
					<FieldError fontSize='12px' h='16px' textAlign='center'>
						{inputError}
					</FieldError>
				</Field>
				<Pad onClickPadButton={handlePadButtonClick} onLongPressPadButton={handlePadButtonLongPressed} />
			</ModalContent>
			<ModalFooter justifyContent='center'>
				<IconButton
					className={callButtonStyle}
					icon='phone'
					disabled={isButtonDisabled}
					borderRadius='full'
					secondary
					info
					size='64px'
					onClick={(): void => {
						handleCallButtonClick();
						handleClose();
					}}
				/>
			</ModalFooter>
		</Modal>
	);
};

export default DialPadModal;
