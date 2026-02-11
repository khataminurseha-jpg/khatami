
import { initializeApp } from "firebase/app";
import { 
  getAuth, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut, 
  onAuthStateChanged,
  User as FirebaseUser
} from "firebase/auth";
import { getFirestore, doc, setDoc, getDoc } from "firebase/firestore";
import { User } from "../types";

// User's provided Firebase config with placeholders
const firebaseConfig = {
    apiKey: "AIzaSyDVYN-_PMIJ7UWybv_0W4nUtP87_YTGiIw", 
    authDomain: "sport-science-system.firebaseapp.com",
    projectId: "sport-science-system",
    storageBucket: "sport-science-system.appspot.com",
    messagingSenderId: "SENDER_ID",
    appId: "APP_ID"
};

let app: any;
let auth: any;
let db: any;
let provider: any;
let isFirebaseInitialized = false;

try {
  // We only initialize if the config looks somewhat valid
  if (firebaseConfig.apiKey && !firebaseConfig.projectId.includes("PROJECT_ID_ANDA")) {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    provider = new GoogleAuthProvider();
    isFirebaseInitialized = true;
  }
} catch (error) {
  console.error("Firebase initialization failed:", error);
}

export const loginWithGoogle = async (): Promise<User | null> => {
  if (!isFirebaseInitialized) {
    throw new Error("Firebase not configured correctly.");
  }
  const result = await signInWithPopup(auth, provider);
  const fUser = result.user;
  return {
    uid: fUser.uid,
    displayName: fUser.displayName,
    email: fUser.email,
    photoURL: fUser.photoURL
  };
};

export const logoutUser = async () => {
  if (auth) await signOut(auth);
};

export const subscribeToAuthChanges = (callback: (user: User | null) => void) => {
  if (!auth) {
    callback(null);
    return () => {};
  }
  return onAuthStateChanged(auth, (fUser) => {
    if (fUser) {
      callback({
        uid: fUser.uid,
        displayName: fUser.displayName,
        email: fUser.email,
        photoURL: fUser.photoURL
      });
    } else {
      callback(null);
    }
  });
};

export const saveToCloud = async (uid: string, data: any) => {
  if (!db) return;
  await setDoc(doc(db, "users", uid), {
    ...data,
    lastUpdated: new Date()
  });
};

export const loadFromCloud = async (uid: string) => {
  if (!db) return null;
  const docRef = doc(db, "users", uid);
  const docSnap = await getDoc(docRef);
  return docSnap.exists() ? docSnap.data() : null;
};

export { isFirebaseInitialized };
