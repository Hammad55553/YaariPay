
import KJUR from 'jsrsasign';
import serviceAccount from '../config/service-account.json';

// Define types for the service account key
interface ServiceAccount {
    project_id: string;
    private_key: string;
    client_email: string;
}

const getAccessToken = async (): Promise<string | null> => {
    try {
        const key = serviceAccount as ServiceAccount;

        const header = {
            alg: 'RS256',
            typ: 'JWT'
        };

        const now = Math.floor(Date.now() / 1000);
        const oneHourSc = 3600;

        const claim = {
            iss: key.client_email,
            scope: "https://www.googleapis.com/auth/firebase.messaging",
            aud: "https://oauth2.googleapis.com/token",
            exp: now + oneHourSc,
            iat: now
        };

        const sHeader = JSON.stringify(header);
        const sClaim = JSON.stringify(claim);

        // Sign the JWT using jsrsasign
        // Note: KJUR methods are synchronous
        const sJWS = (KJUR as any).jws.JWS.sign(null, sHeader, sClaim, key.private_key);

        // Exchange JWT for Access Token
        const response = await fetch("https://oauth2.googleapis.com/token", {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded"
            },
            body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${sJWS}`
        });

        const data = await response.json();
        return data.access_token || null;

    } catch (error) {
        console.error("Error generating OAuth2 Token:", error);
        return null;
    }
};

export const sendNotification = async (title: string, body: string, senderId: string, type: string = 'chat_message') => {
    try {
        // 1. Get a fresh Access Token
        const accessToken = await getAccessToken();

        if (!accessToken) {
            console.error("Failed to get access token for notification");
            return;
        }

        // 2. Construct the Payload (FCM V1)
        const project_id = serviceAccount.project_id;
        const url = `https://fcm.googleapis.com/v1/projects/${project_id}/messages:send`;

        const payload = {
            message: {
                topic: 'general',
                notification: {
                    title: title,
                    body: body,
                },
                data: {
                    type: type,
                    timestamp: new Date().toISOString(),
                    senderId: senderId
                },
                android: {
                    notification: {
                        sound: 'default',
                        channel_id: 'default'
                    }
                }
            }
        };

        // 3. Send Request
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        const json = await response.json();

        if (response.ok) {
            console.log("✅ V1 Notification Sent (Client-Side):", json.name);
        } else {
            console.error("❌ V1 Send Failed:", json);
        }

    } catch (error) {
        console.error("Error sending notification:", error);
    }
};
