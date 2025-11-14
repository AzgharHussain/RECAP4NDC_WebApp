const { sequelize } = require('../config/database');
const admin = require('firebase-admin');

// Initialize Firebase Admin SDK
let firebaseInitialized = false;
try {
  const privateKey = require('./private-key.json');
  admin.initializeApp({
    credential: admin.credential.cert(privateKey),
  });
  firebaseInitialized = true;
  console.log('✅ Firebase Admin SDK initialized');
} catch (error) {
  console.log('❌ Firebase Admin SDK initialization failed:', error.message);
  process.exit(1);
}

async function sendFCMNotification(fcmToken, message) {
  try {
    await admin.messaging().send({
      token: fcmToken,
      notification: {
        title: 'Deforestation Alert!',
        body: message,
      },
    });
    console.log('✅ FCM notification sent successfully');
    return true;
  } catch (err) {
    console.error('❌ Error sending FCM notification:', err.message);
    return false;
  }
}

async function getFCMTokensForCoopUsers(coopId) {
  try {
    // Get all users associated with this coop
    const [users] = await sequelize.query(`
      SELECT u.id, u.fcm_token, u.email, u.name 
      FROM users u
      INNER JOIN user_coops uc ON u.id = uc.user_id
      WHERE uc.coop_id = $1 
      AND u.fcm_token IS NOT NULL
      AND u.fcm_token != ''
      AND u.notifications_enabled = true
    `, {
      bind: [coopId]
    });
    
    if (users.length > 0) {
      console.log(`📱 Found ${users.length} users with FCM tokens for coop ${coopId}`);
      return users.map(user => ({
        token: user.fcm_token,
        userId: user.id,
        email: user.email,
        name: user.name
      }));
    }
    
    console.log(`⚠️ No users with FCM tokens found for coop ${coopId}`);
    return [];
  } catch (err) {
    console.error(`❌ Error getting FCM tokens for coop ${coopId}:`, err.message);
    return [];
  }
}

async function processPendingNotifications() {
  try {
    // Get pending notifications
    const [pendingNotifications] = await sequelize.query(`
      SELECT id, coop_id, poly_id, month, message 
      FROM global_deforestation_notifications 
      WHERE status = 'PENDING'
      ORDER BY created_at ASC
      LIMIT 50
    `);

    console.log(`📨 Processing ${pendingNotifications.length} pending notifications`);

    let totalSent = 0;
    let totalFailed = 0;
    
    for (const notification of pendingNotifications) {
      console.log(`\n🔔 Processing notification for coop ${notification.coop_id}, polygon ${notification.poly_id}`);
      
      // Get all users with FCM tokens for this coop
      const usersWithTokens = await getFCMTokensForCoopUsers(notification.coop_id);
      
      if (usersWithTokens.length === 0) {
        console.log(`❌ No users to notify for coop ${notification.coop_id}`);
        await updateNotificationStatus([notification.id], 'FAILED');
        totalFailed++;
        continue;
      }

      let sentCount = 0;
      let failedCount = 0;
      const userResults = [];

      // Send notification to each user
      for (const user of usersWithTokens) {
        try {
          const sent = await sendFCMNotification(user.token, notification.message);
          if (sent) {
            sentCount++;
            userResults.push({
              userId: user.userId,
              status: 'SENT',
              email: user.email
            });
            console.log(`✅ Notification sent to user: ${user.email}`);
          } else {
            failedCount++;
            userResults.push({
              userId: user.userId,
              status: 'FAILED',
              email: user.email
            });
            console.log(`❌ Failed to send to user: ${user.email}`);
          }
        } catch (err) {
          failedCount++;
          userResults.push({
            userId: user.userId,
            status: 'FAILED',
            email: user.email,
            error: err.message
          });
          console.error(`❌ Error sending to user ${user.email}:`, err.message);
        }
      }

      // Log user notification results
      await logUserNotificationResults(notification.id, userResults);

      // Update main notification status based on results
      if (sentCount > 0) {
        await updateNotificationStatus([notification.id], 'SENT');
        console.log(`✅ Successfully sent to ${sentCount} users for notification ${notification.id}`);
        totalSent++;
      } else {
        await updateNotificationStatus([notification.id], 'FAILED');
        console.log(`❌ Failed to send to all users for notification ${notification.id}`);
        totalFailed++;
      }
    }

    console.log(`\n📊 Notification Summary:`);
    console.log(`   ✅ Successfully processed: ${totalSent} notifications`);
    console.log(`   ❌ Failed: ${totalFailed} notifications`);
    
    return { sent: totalSent, failed: totalFailed };
  } catch (err) {
    console.error('❌ Error processing pending notifications:', err.message);
    return { sent: 0, failed: 0 };
  }
}

async function logUserNotificationResults(notificationId, userResults) {
  try {
    for (const result of userResults) {
      await sequelize.query(
        `INSERT INTO user_notification_logs 
         (notification_id, user_id, status, user_email, error_message, created_at)
         VALUES ($1, $2, $3, $4, $5, NOW())`,
        {
          bind: [
            notificationId,
            result.userId,
            result.status,
            result.email,
            result.error || null
          ]
        }
      );
    }
    console.log(`📝 Logged ${userResults.length} user notification results`);
  } catch (err) {
    console.error('❌ Error logging user notification results:', err.message);
  }
}

async function updateNotificationStatus(notificationIds, status) {
  try {
    if (!notificationIds.length) return;
    
    const placeholders = notificationIds.map((_, i) => `$${i + 1}`).join(',');
    await sequelize.query(
      `UPDATE global_deforestation_notifications 
       SET status = $${notificationIds.length + 1}, updated_at = NOW()
       WHERE id IN (${placeholders})`,
      {
        bind: [...notificationIds, status]
      }
    );
    
    console.log(`✅ Updated ${notificationIds.length} notifications to status: ${status}`);
  } catch (err) {
    console.error('❌ Error updating notification status:', err.message);
  }
}

async function createNotificationTables() {
  try {
    // Create user notification logs table if not exists
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS user_notification_logs (
        id SERIAL PRIMARY KEY,
        notification_id INTEGER REFERENCES global_deforestation_notifications(id),
        user_id INTEGER,
        user_email TEXT,
        status TEXT,
        error_message TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create index for better performance
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_user_notification_logs_notification_id 
      ON user_notification_logs(notification_id);
    `);

    console.log('✅ Notification tables created/verified');
  } catch (err) {
    console.error('❌ Error creating notification tables:', err.message);
  }
}

async function getNotificationStats() {
  try {
    const [stats] = await sequelize.query(`
      SELECT 
        status,
        COUNT(*) as count
      FROM global_deforestation_notifications 
      GROUP BY status
    `);

    const [userStats] = await sequelize.query(`
      SELECT 
        status,
        COUNT(*) as count
      FROM user_notification_logs 
      GROUP BY status
    `);

    console.log('\n📊 Notification Statistics:');
    console.log('   Global Notifications:');
    stats.forEach(stat => {
      console.log(`     ${stat.status}: ${stat.count}`);
    });

    console.log('   User Delivery:');
    userStats.forEach(stat => {
      console.log(`     ${stat.status}: ${stat.count}`);
    });

    return { global: stats, user: userStats };
  } catch (err) {
    console.error('❌ Error getting notification stats:', err.message);
    return { global: [], user: [] };
  }
}

// Main execution
async function main() {
  try {
    // Test database connection
    await sequelize.authenticate();
    console.log('✅ Database connection established');

    // Create necessary tables
    await createNotificationTables();

    // Process pending notifications
    const result = await processPendingNotifications();

    // Show final statistics
    await getNotificationStats();

    console.log(`\n🎉 Notification service completed`);
    console.log(`   Total notifications processed: ${result.sent + result.failed}`);
    console.log(`   Successfully sent: ${result.sent}`);
    console.log(`   Failed: ${result.failed}`);

  } catch (err) {
    console.error('❌ Notification service failed:', err);
    process.exit(1);
  } finally {
    await sequelize.close();
    console.log('🔌 Database connection closed');
  }
}

// Run the service
if (require.main === module) {
  main().then(() => {
    process.exit(0);
  });
}

module.exports = {
  processPendingNotifications,
  getFCMTokensForCoopUsers,
  updateNotificationStatus,
  getNotificationStats
};


