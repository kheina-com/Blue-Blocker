import { api, DefaultOptions } from '../constants';
import { commafy } from '../utilities';

// set the block value immediately
api.storage.local.get({ BlockCounter: 0, BlockQueue: [] }).then((items) => {
  const blockCounter = document.getElementById('blocked-users-count') as HTMLElement;
  blockCounter.innerText = commafy(items.BlockCounter);
  const blockQueueLength = document.getElementById('blocked-user-queue-length') as HTMLElement;
  blockQueueLength.innerText = commafy(items.BlockQueue.length);
});
api.storage.local.onChanged.addListener((items) => {
  if (items.hasOwnProperty('BlockCounter')) {
    const blockedCounter = document.getElementById('blocked-users-count') as HTMLElement;
    blockedCounter.innerText = commafy(items.BlockCounter.newValue);
  }
  if (items.hasOwnProperty('BlockQueue')) {
    const blockQueueLength = document.getElementById('blocked-user-queue-length') as HTMLElement;
    blockQueueLength.innerText = commafy(items.BlockQueue.newValue.length);
  }
  // if we want to add other values, add them here
});

const version = document.getElementById('version') as HTMLElement;
version.innerText = `v${api.runtime.getManifest().version}`;

// restore state from storage
document.addEventListener('DOMContentLoaded', () => {
  const suspendBlockCollection = document.getElementById(
    'suspend-block-collection',
  ) as HTMLInputElement;
  const showBlockPopups = document.getElementById('show-block-popups') as HTMLInputElement;
  const mute = document.getElementById('mute-instead-of-block') as HTMLInputElement;
  const blockFollowing = document.getElementById('block-following') as HTMLInputElement;
  const blockFollowers = document.getElementById('block-followers') as HTMLInputElement;
  const skipVerified = document.getElementById('skip-verified') as HTMLInputElement;
  const skipAffiliated = document.getElementById('skip-affiliated') as HTMLInputElement;
  const skip1MPlus = document.getElementById('skip-1mplus') as HTMLInputElement;
  const blockNftAvatars = document.getElementById('block-nft-avatars') as HTMLInputElement;
  const blockInterval = document.getElementById('block-interval') as HTMLInputElement;
  const blockIntervalValue = document.getElementById('block-interval-value') as HTMLInputElement;

  api.storage.sync.get(DefaultOptions).then((_items) => {
    const config = <Config>_items;

    suspendBlockCollection.checked = config.suspendedBlockCollection;
    showBlockPopups.checked = config.showBlockPopups;
    mute.checked = config.mute;
    blockFollowing.checked = config.blockFollowing;
    blockFollowers.checked = config.blockFollowers;
    skipVerified.checked = config.skipVerified;
    skipAffiliated.checked = config.skipAffiliated;
    skip1MPlus.checked = config.skip1Mplus;
    blockNftAvatars.checked = config.blockNftAvatars;
    blockInterval.value = config.blockInterval.toString();
    blockIntervalValue.innerText = config.blockInterval.toString() + 's';
  });

  suspendBlockCollection.addEventListener('input', (e) => {
    const target = e.target as HTMLInputElement;
    api.storage.sync
      .set({
        suspendedBlockCollection: target.checked,
      })
      .then(() => {
        // Update status to let user know options were saved.
        const status = document.getElementById('suspend-block-collection-status') as HTMLElement;
        status.textContent = 'saved';
        setTimeout(() => (status.textContent = null), 1000);
      });
  });

  showBlockPopups.addEventListener('input', (e) => {
    if (!e?.target) return;
    const target = e.target as HTMLInputElement;
    api.storage.sync
      .set({
        showBlockPopups: target.checked,
      })
      .then(() => {
        // Update status to let user know options were saved.
        const status = document.getElementById('show-block-popups-status') as HTMLElement;
        status.textContent = 'saved';
        setTimeout(() => (status.textContent = null), 1000);
      });
  });

  mute.addEventListener('input', (e) => {
    if (!e?.target) return;
    const target = e.target as HTMLInputElement;
    api.storage.sync
      .set({
        mute: target.checked,
      })
      .then(() => {
        // Update status to let user know options were saved.
        const status = document.getElementById('mute-instead-of-block-status') as HTMLElement;
        status.textContent = 'saved';
        setTimeout(() => (status.textContent = null), 1000);
      });
  });

  blockFollowing.addEventListener('input', (e) => {
    if (!e?.target) return;
    const target = e.target as HTMLInputElement;
    api.storage.sync
      .set({
        blockFollowing: target.checked,
      })
      .then(() => {
        // Update status to let user know options were saved.
        const status = document.getElementById('block-following-status') as HTMLElement;
        status.textContent = 'saved';
        setTimeout(() => (status.textContent = null), 1000);
      });
  });

  blockFollowing.addEventListener('input', (e) => {
    if (!e?.target) return;
    const target = e.target as HTMLInputElement;
    api.storage.sync
      .set({
        blockFollowers: target.checked,
      })
      .then(() => {
        // Update status to let user know options were saved.
        const status = document.getElementById('block-followers-status') as HTMLElement;
        status.textContent = 'saved';
        setTimeout(() => (status.textContent = null), 1000);
      });
  });

  skipVerified.addEventListener('input', (e) => {
    if (!e?.target) return;
    const target = e.target as HTMLInputElement;
    api.storage.sync
      .set({
        skipVerified: target.checked,
      })
      .then(() => {
        // Update status to let user know options were saved.
        const status = document.getElementById('skip-verified-status') as HTMLElement;
        status.textContent = 'saved';
        setTimeout(() => (status.textContent = null), 1000);
      });
  });

  skipAffiliated.addEventListener('input', (e) => {
    if (!e?.target) return;
    const target = e.target as HTMLInputElement;
    api.storage.sync
      .set({
        skipAffiliated: target.checked,
      })
      .then(() => {
        // Update status to let user know options were saved.
        const status = document.getElementById('skip-affiliated-status') as HTMLElement;
        status.textContent = 'saved';
        setTimeout(() => (status.textContent = null), 1000);
      });
  });

  skip1MPlus.addEventListener('input', (e) => {
    if (!e?.target) return;
    const target = e.target as HTMLInputElement;
    api.storage.sync
      .set({
        skip1Mplus: target.checked,
      })
      .then(() => {
        // Update status to let user know options were saved.
        const status = document.getElementById('skip-1mplus-status') as HTMLElement;
        status.textContent = 'saved';
        setTimeout(() => (status.textContent = null), 1000);
      });
  });

  blockNftAvatars.addEventListener('input', (e) => {
    if (!e?.target) return;
    const target = e.target as HTMLInputElement;
    api.storage.sync
      .set({
        blockNftAvatars: target.checked,
      })
      .then(() => {
        // Update status to let user know options were saved.
        const status = document.getElementById('block-nft-avatars-status') as HTMLElement;
        status.textContent = 'saved';
        setTimeout(() => (status.textContent = null), 1000);
      });
  });

  blockInterval.addEventListener('input', (e) => {
    if (!e?.target) return;
    const target = e.target as HTMLInputElement;
    blockIntervalValue.innerText = target.value.toString() + 's';
  });

  blockInterval.addEventListener('change', (e) => {
    if (!e?.target) return;
    const target = e.target as HTMLInputElement;
    api.storage.sync
      .set({
        blockInterval: parseInt(target.value),
      })
      .then(() => {
        // Update status to let user know options were saved.
        const status = document.getElementById('block-interval-status') as HTMLElement;
        status.textContent = 'saved';
        setTimeout(() => (status.textContent = null), 1000);
      });
  });
});
