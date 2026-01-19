import '../style.css';
import './style.css';
import { api, ConsentGranted } from '../../constants';

const accept = document.getElementById('accept');
const refuse = document.getElementById('refuse');

accept?.addEventListener('click', async () => {
	api.runtime.sendMessage({
		action: ConsentGranted,
	});
	window.close();
});

refuse?.addEventListener('click', () => {
	api.management.uninstallSelf();
});
