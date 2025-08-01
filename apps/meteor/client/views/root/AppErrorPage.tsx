import { Box, PaletteStyleTag, States, StatesAction, StatesActions, StatesIcon, StatesSubtitle, StatesTitle } from '@rocket.chat/fuselage';
import { useThemeMode } from '@rocket.chat/ui-theming';
import type { ErrorInfo, ReactElement } from 'react';

type AppErrorPageProps = {
	error: Error;
	info?: ErrorInfo;
	clearError: () => void;
};

const AppErrorPage = (_props: AppErrorPageProps): ReactElement => {
	const [, , theme] = useThemeMode();

	return (
		<>
			<PaletteStyleTag theme={theme} tagId='app-error-palette' />
			<Box display='flex' justifyContent='center' height='full' backgroundColor='surface'>
				<States>
					<StatesIcon name='error-circle' />
					<StatesTitle>Application Error</StatesTitle>
					<StatesSubtitle>The application GUI just crashed.</StatesSubtitle>

					<StatesActions>
						<StatesAction
							onClick={() => {
								const result = indexedDB.deleteDatabase('MeteorDynamicImportCache');
								result.onsuccess = () => {
									window.location.reload();
								};
								result.onerror = () => {
									window.location.reload();
								};
							}}
						>
							Reload Application
						</StatesAction>
					</StatesActions>
				</States>
			</Box>
		</>
	);
};

export default AppErrorPage;
