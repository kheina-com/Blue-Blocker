import { api } from '../constants';
import { abbreviate } from '../utilities';

api.action.setBadgeBackgroundColor({ color: '#666' });
api.action.setBadgeTextColor({ color: '#fff' });

api.storage.local.onChanged.addListener((items) => {
  if (items.hasOwnProperty('BlockCounter')) {
    api.action.setBadgeText({
      text: abbreviate(items.BlockCounter.newValue),
    });
  }
});
