// "Alle Daten löschen": removes everything this app stores on the device.

/** @param {string} name */
function deleteDatabase(name) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(name);
    request.onsuccess = () => resolve(undefined);
    request.onerror = () => reject(request.error);
    // another tab still holds the DB open – deletion completes once it closes
    request.onblocked = () => resolve(undefined);
  });
}

export async function wipeAllData() {
  localStorage.clear();
  const databases = await indexedDB.databases();
  await Promise.all(databases.map((db) => db.name && deleteDatabase(db.name)));
}
