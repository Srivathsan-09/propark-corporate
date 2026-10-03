const mongoose = require('mongoose');

const uri = 'mongodb+srv://srivathsan0906_db_user:bRYPrKQNnkATvrKg@cluster0.gvnohhm.mongodb.net/CommuteX?retryWrites=true&w=majority';

async function syncRecord() {
  await mongoose.connect(uri);
  const result = await mongoose.connection.collection('carbonemissions').updateOne(
    { rideId: new mongoose.Types.ObjectId('6a981c069f5103c8e838e425') },
    {
      $set: {
        soloBaselineCO2Kg: 3.06,
        actualCarpoolCO2Kg: 10.18,
        co2SavedKg: -7.12,
        grossDifferenceKg: -7.12,
        netEmissionsIncreaseKg: 7.12,
        co2ReductionPercentage: -232.68,
        vehicleKilometersReduced: -49.9,
        'passengers.0.soloEmissionKg': 3.06,
      },
    }
  );
  console.log('Update result:', result);
  const updated = await mongoose.connection
    .collection('carbonemissions')
    .findOne({ rideId: new mongoose.Types.ObjectId('6a981c069f5103c8e838e425') });
  console.log('Updated record:', JSON.stringify(updated, null, 2));
  await mongoose.disconnect();
}

syncRecord().catch((err) => {
  console.error('Error syncing record:', err);
  process.exit(1);
});
