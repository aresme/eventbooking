const projectId = 'univibe-events-9c77f';
const baseUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`;

async function clearCollection(collection) {
  try {
    console.log(`Fetching ${collection}...`);
    const res = await fetch(`${baseUrl}/${collection}`);
    const data = await res.json();
    if (data.documents) {
      for (const doc of data.documents) {
        console.log(`Deleting ${doc.name}...`);
        await fetch(`https://firestore.googleapis.com/v1/${doc.name}`, { method: 'DELETE' });
      }
      console.log(`Cleared ${collection}.`);
    } else {
      console.log(`${collection} is empty.`);
    }
  } catch (err) {
    console.error(`Error clearing ${collection}:`, err);
  }
}

async function run() {
  await clearCollection('events');
  await clearCollection('bookings');
  await clearCollection('waitlists');
}
run();
