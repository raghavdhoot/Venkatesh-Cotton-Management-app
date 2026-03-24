import { db } from './firebaseConfig';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

export const logActivity = async (user, action, details) => {
    try {
        await addDoc(collection(db, 'auditLogs'), {
            userEmail: user.email,
            userName: user.name,
            action: action.toUpperCase(),
            details: details.toUpperCase(),
            timestamp: serverTimestamp()
        });
    } catch (error) {
        console.error("Error logging activity: ", error);
    }
};
