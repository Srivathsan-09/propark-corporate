const mongoose = require('mongoose');
const assert = require('assert');

const uri = 'mongodb+srv://srivathsan0906_db_user:bRYPrKQNnkATvrKg@cluster0.gvnohhm.mongodb.net/CommuteX?retryWrites=true&w=majority';

async function testLiveDb() {
  console.log("Connecting to live MongoDB cluster...");
  await mongoose.connect(uri);

  const ce = await mongoose.connection.collection('carbonemissions').find({}).toArray();
  console.log(`Found ${ce.length} carbon emission record(s) in database.\n`);

  assert.ok(ce.length > 0, "Must have at least 1 completed ride carbon emission record");

  const record = ce[0];
  console.log("Live Record Details:");
  console.log(`- Ride ID: ${record.rideId}`);
  console.log(`- Solo Baseline CO2: ${record.soloBaselineCO2Kg} kg`);
  console.log(`- Carpool Emissions: ${record.actualCarpoolCO2Kg} kg`);
  console.log(`- Net CO2 Avoided: ${record.co2SavedKg} kg`);
  console.log(`- Net Emissions Increase: ${record.netEmissionsIncreaseKg} kg`);
  console.log(`- CO2 Reduction Percentage: ${record.co2ReductionPercentage}%\n`);

  // Verify numerical consistency
  assert.strictEqual(record.soloBaselineCO2Kg, 3.06, "Solo baseline must be 3.06 kg");
  assert.strictEqual(record.actualCarpoolCO2Kg, 10.18, "Carpool emissions must be 10.18 kg");
  assert.strictEqual(record.co2SavedKg, -7.12, "Avoided CO2 must be -7.12 kg");
  assert.strictEqual(record.netEmissionsIncreaseKg, 7.12, "Net emissions increase must be 7.12 kg");
  assert.strictEqual(record.co2ReductionPercentage, -232.68, "Reduction percentage must be -232.68%");

  // Verify formula: solo - carpool = avoided
  const calculatedAvoided = Math.round((record.soloBaselineCO2Kg - record.actualCarpoolCO2Kg) * 100) / 100;
  assert.strictEqual(calculatedAvoided, record.co2SavedKg, "Solo - Carpool must equal avoided CO2");

  // Verify formula: carpool - solo = increase
  const calculatedIncrease = Math.round((record.actualCarpoolCO2Kg - record.soloBaselineCO2Kg) * 100) / 100;
  assert.strictEqual(calculatedIncrease, record.netEmissionsIncreaseKg, "Carpool - Solo must equal net emissions increase");

  // Verify formula: (avoided / solo) * 100 = reduction %
  const calculatedPct = Math.round((record.co2SavedKg / record.soloBaselineCO2Kg) * 10000) / 100;
  assert.strictEqual(calculatedPct, record.co2ReductionPercentage, "(Avoided / Solo) * 100 must equal reduction %");

  console.log(" ALL LIVE DATABASE RECORD VERIFICATIONS PASSED!");
  await mongoose.disconnect();
}

testLiveDb().catch((err) => {
  console.error("Live DB Verification Failed:", err);
  process.exit(1);
});
