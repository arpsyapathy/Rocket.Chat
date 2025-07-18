import type { SelectOption } from '@rocket.chat/fuselage';
import { AccordionItem, Field, FieldGroup, FieldHint, FieldLabel, FieldRow, Select, Slider, ToggleSwitch } from '@rocket.chat/fuselage';
import type { TranslationKey } from '@rocket.chat/ui-contexts';
import { useCustomSound, useTranslation } from '@rocket.chat/ui-contexts';
import { useId } from 'react';
import { Controller, useFormContext } from 'react-hook-form';

const PreferencesSoundSection = () => {
	const t = useTranslation();

	const customSound = useCustomSound();
	const soundsList: SelectOption[] = customSound.list?.map((value) => [value._id, t(value.name as TranslationKey)]) || [];
	const { control, watch } = useFormContext();
	const { newMessageNotification, notificationsSoundVolume = 100, masterVolume = 100, voipRingerVolume = 100 } = watch();

	const newRoomNotificationId = useId();
	const newMessageNotificationId = useId();
	const muteFocusedConversationsId = useId();
	const masterVolumeId = useId();
	const notificationsSoundVolumeId = useId();
	const voipRingerVolumeId = useId();

	return (
		<AccordionItem title={t('Sound')}>
			<FieldGroup>
				<Field>
					<FieldLabel is='span' aria-describedby={`${masterVolumeId}-hint`}>
						{t('Master_volume')}
					</FieldLabel>
					<FieldHint id={`${masterVolumeId}-hint`} mbe={4}>
						{t('Master_volume_hint')}
					</FieldHint>
					<FieldRow>
						<Controller
							name='masterVolume'
							control={control}
							render={({ field: { onChange, value } }) => (
								<Slider
									aria-label={t('Master_volume')}
									aria-describedby={`${masterVolumeId}-hint`}
									value={value}
									minValue={0}
									maxValue={100}
									onChange={onChange}
								/>
							)}
						/>
					</FieldRow>
				</Field>
				<Field>
					<FieldLabel is='span' id={notificationsSoundVolumeId}>
						{t('Notification_volume')}
					</FieldLabel>
					<FieldHint id={`${notificationsSoundVolumeId}-hint`} mbe={4}>
						{t('Notification_volume_hint')}
					</FieldHint>
					<FieldRow>
						<Controller
							name='notificationsSoundVolume'
							control={control}
							render={({ field: { onChange, value } }) => (
								<Slider
									aria-label={t('Notification_volume')}
									aria-describedby={`${notificationsSoundVolumeId}-hint`}
									value={value}
									minValue={0}
									maxValue={100}
									onChange={(value: number) => {
										const soundVolume = (notificationsSoundVolume * masterVolume) / 100;
										customSound.play(newMessageNotification, { volume: soundVolume / 100 });
										onChange(value);
									}}
								/>
							)}
						/>
					</FieldRow>
				</Field>
				<Field>
					<FieldLabel is='span' aria-describedby={`${voipRingerVolumeId}-hint`}>
						{t('Call_ringer_volume')}
					</FieldLabel>
					<FieldHint id={`${voipRingerVolumeId}-hint`} mbe={4}>
						{t('Call_ringer_volume_hint')}
					</FieldHint>
					<FieldRow>
						<Controller
							name='voipRingerVolume'
							control={control}
							render={({ field: { onChange, value } }) => (
								<Slider
									aria-label={t('Call_ringer_volume')}
									aria-describedby={`${voipRingerVolumeId}-hint`}
									value={value}
									minValue={0}
									maxValue={100}
									onChange={(value: number) => {
										const soundVolume = (voipRingerVolume * masterVolume) / 100;
										customSound.play('telephone', { volume: soundVolume / 100 });
										onChange(value);
									}}
								/>
							)}
						/>
					</FieldRow>
				</Field>
				<Field>
					<FieldLabel is='span' id={newRoomNotificationId}>
						{t('New_Room_Notification')}
					</FieldLabel>
					<FieldRow>
						<Controller
							name='newRoomNotification'
							control={control}
							render={({ field: { value, onChange } }) => (
								<Select
									aria-labelledby={newRoomNotificationId}
									value={value}
									options={soundsList}
									onChange={(value) => {
										onChange(value);
										customSound.play(String(value), { volume: notificationsSoundVolume / 100 });
									}}
								/>
							)}
						/>
					</FieldRow>
				</Field>
				<Field>
					<FieldLabel is='span' id={newMessageNotificationId}>
						{t('New_Message_Notification')}
					</FieldLabel>
					<FieldRow>
						<Controller
							name='newMessageNotification'
							control={control}
							render={({ field: { value, onChange } }) => (
								<Select
									aria-labelledby={newMessageNotificationId}
									value={value}
									options={soundsList}
									onChange={(value) => {
										onChange(value);
										customSound.play(String(value), { volume: notificationsSoundVolume / 100 });
									}}
								/>
							)}
						/>
					</FieldRow>
				</Field>
				<Field>
					<FieldRow>
						<FieldLabel htmlFor={muteFocusedConversationsId}>{t('Mute_Focused_Conversations')}</FieldLabel>
						<Controller
							name='muteFocusedConversations'
							control={control}
							render={({ field: { ref, value, onChange } }) => (
								<ToggleSwitch id={muteFocusedConversationsId} ref={ref} checked={value} onChange={onChange} />
							)}
						/>
					</FieldRow>
				</Field>
			</FieldGroup>
		</AccordionItem>
	);
};

export default PreferencesSoundSection;
