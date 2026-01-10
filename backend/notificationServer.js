const admin = require('firebase-admin');
const serviceAccount = require('./yaripay-firebase-adminsdk-fbsvc-289c3fe69d.json');

// Initialize Firebase Admin SDK
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
const messaging = admin.messaging();

console.log("🔥 Notification Server Started...");
console.log("🎧 Listening for new messages in Firestore...");

// Listen to the 'messages' collection
db.collection('messages')
    .orderBy('createdAt', 'desc')
    .limit(1)
    .onSnapshot(snapshot => {
        if (snapshot.empty) return;

        snapshot.docChanges().forEach(change => {
            if (change.type === 'added') {
                const messageData = change.doc.data();
                const messageId = change.doc.id;

                // Verify message is recent (within last 10 seconds) to avoid spamming on restart
                const now = new Date();
                const msgTime = messageData.createdAt ? messageData.createdAt.toDate() : new Date();
                const diff = (now - msgTime) / 1000;

                if (diff > 10) {
                    // Ignore old messages loaded on startup
                    return;
                }

                console.log(`📩 New Message from ${messageData.user.name}: ${messageData.text}`);

                // Construct the Notification Payload (HTTP v1)
                const payload = {
                    topic: 'general', // Sending to the "general" topic (Free broadcast)
                    notification: {
                        title: `New Message from ${messageData.user.name}`,
                        body: messageData.text,
                    },
                    data: {
                        messageId: messageId,
                        senderId: messageData.user._id,
                        type: 'chat_message'
                    }
                };

                // Send via FCM V1 API
                messaging.send(payload)
                    .then((response) => {
                        console.log('✅ Notification sent successfully:', response);
                    })
                    .catch((error) => {
                        console.error('❌ Error sending notification:', error);
                    });
            }
        });
    }, error => {
        console.error("❌ Firestore Listener Error:", error);
    });
