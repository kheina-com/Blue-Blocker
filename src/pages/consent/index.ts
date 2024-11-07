import '../style.css';
import './style.css';
import { api } from '../../constants';

const accept = document.getElementById('accept');
const refuse = document.getElementById('refuse');

accept?.addEventListener('click', async () => {
    await api.storage.local.remove('holdUntilConsent');
    window.close();
});

refuse?.addEventListener('click', () => {
    api.management.uninstallSelf();
})