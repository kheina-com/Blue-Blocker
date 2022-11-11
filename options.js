function saveBlockFollowing() {
	console.log("triggered");
	const blockFollowing = document.getElementById("block-following").checked;

	chrome.storage.sync.set({
		blockFollowing,
	}, () => {
		// Update status to let user know options were saved.
		const status = document.getElementById("block-following-status");
		status.textContent = "saved";
		setTimeout(() => status.textContent = null, 1000);
	});
}
  
// restore state from storage
function loadOptions() {
	chrome.storage.sync.get({
		// by default, spare the people we follow from getting blocked
		blockFollowing: false,
	}, items => document.getElementById("block-following").checked = items.blockFollowing);
}
document.addEventListener("DOMContentLoaded", loadOptions);
document.getElementById("block-following").addEventListener("input", saveBlockFollowing);
  