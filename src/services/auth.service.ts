import { signInWithPopup, signOut as firebaseSignOut, type User } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, googleProvider, db } from './firebase';

const allowedEmails = import.meta.env.VITE_ALLOWED_EMAILS ? import.meta.env.VITE_ALLOWED_EMAILS.split(',') : [];

export const authService = {
  async signInWithGoogle(): Promise<User> {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;

      if (!allowedEmails.includes(user.email)) {
        alert("You are not authorized to use this app.");
        await firebaseSignOut(auth);
      }
      
      // Save user data to Firestore
      await setDoc(doc(db, 'users', user.uid), {
        displayName: user.displayName,
        email: user.email,
        photoURL: user.photoURL,
        createdAt: new Date().toISOString(),
      }, { merge: true });

      return user;
    } catch (error) {
      throw new Error('Failed to sign in with Google');
    }
  },

  async signOut(): Promise<void> {
    try {
      await firebaseSignOut(auth);
    } catch (error) {
      throw new Error('Failed to sign out');
    }
  },

  async getCurrentUser(): Promise<User | null> {
    return new Promise((resolve) => {
      const unsubscribe = auth.onAuthStateChanged((user) => {
        unsubscribe();
        resolve(user);
      });
    });
  }
};
