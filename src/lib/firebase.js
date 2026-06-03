// src/lib/firebase.js - COMPLETE VERSION
import { initializeApp } from 'firebase/app';
import { getAnalytics, setAnalyticsCollectionEnabled } from 'firebase/analytics';
import { getFirestore, enableIndexedDbPersistence } from 'firebase/firestore';
import { getAuth, setPersistence, browserLocalPersistence } from 'firebase/auth';
import { getStorage } from 'firebase/storage';
import { getPerformance } from 'firebase/performance';
import { getFunctions } from 'firebase/functions';

// Configuration validation
const validateFirebaseConfig = (config) => {
  const requiredFields = [
    'apiKey',
    'authDomain', 
    'projectId',
    'storageBucket',
    'messagingSenderId',
    'appId'
  ];

  const missingFields = requiredFields.filter(field => !config[field]);
  
  if (missingFields.length > 0) {
    console.error(`🚫 Firebase: Missing required fields: ${missingFields.join(', ')}`);
    return false;
  }

  // Validate format
  if (!config.apiKey.startsWith('AIza')) {
    console.error('🚫 Firebase: Invalid API key format');
    return false;
  }

  if (!config.projectId.match(/^[a-z0-9-]+$/)) {
    console.error('🚫 Firebase: Invalid project ID format');
    return false;
  }

  return true;
};

// Environment-based configuration
const getFirebaseConfig = () => {
  const env = import.meta.env;
  
  // Production configuration
  if (env.PROD) {
    return {
      apiKey: env.VITE_FIREBASE_API_KEY,
      authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
      projectId: env.VITE_FIREBASE_PROJECT_ID,
      storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
      appId: env.VITE_FIREBASE_APP_ID,
      measurementId: env.VITE_FIREBASE_MEASUREMENT_ID
    };
  }
  
  // Development/Staging configuration with fallbacks
  return {
    apiKey: env.VITE_FIREBASE_API_KEY || 'demo-key-for-development',
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || 'sianagritech-dev.firebaseapp.com',
    projectId: env.VITE_FIREBASE_PROJECT_ID || 'sianagritech-dev',
    storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || 'sianagritech-dev.appspot.com',
    messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || '1234567890',
    appId: env.VITE_FIREBASE_APP_ID || '1:1234567890:web:abcdef123456',
    measurementId: env.VITE_FIREBASE_MEASUREMENT_ID || 'G-ABCDEF1234'
  };
};

// Firebase services singleton
class FirebaseService {
  constructor() {
    this._app = null;
    this._analytics = null;
    this._firestore = null;
    this._auth = null;
    this._storage = null;
    this._performance = null;
    this._functions = null;
    this._initialized = false;
  }

  async initialize() {
    // Only initialize in browser environment
    if (typeof window === 'undefined') {
      console.warn('Firebase: Skipping initialization in SSR/Node.js environment');
      return this;
    }

    if (this._initialized) {
      console.log('Firebase: Already initialized');
      return this;
    }

    try {
      const config = getFirebaseConfig();
      
      if (!validateFirebaseConfig(config)) {
        console.warn('Firebase: Invalid configuration, using null services');
        this._initialized = true;
        return this;
      }

      // Initialize Firebase App
      this._app = initializeApp(config);
      console.log(`✅ Firebase initialized for ${import.meta.env.PROD ? 'Production' : 'Development'}`);

      // Initialize services with error handling
      await this._initializeServices();
      
      this._initialized = true;
      
    } catch (error) {
      console.error('🚫 Firebase initialization failed:', error);
      // Don't throw - allow app to run without Firebase
    }

    return this;
  }

  async _initializeServices() {
    try {
      // Analytics (only in production)
      if (import.meta.env.PROD) {
        this._analytics = getAnalytics(this._app);
        setAnalyticsCollectionEnabled(this._analytics, true);
      }

      // Firestore with offline persistence
      this._firestore = getFirestore(this._app);
      if (!import.meta.env.PROD) {
        // Enable offline persistence in development
        await enableIndexedDbPersistence(this._firestore).catch(err => {
          if (err.code === 'failed-precondition') {
            console.warn('Firestore: Multiple tabs open, persistence only in first tab');
          } else if (err.code === 'unimplemented') {
            console.warn('Firestore: Browser doesn\'t support persistence');
          }
        });
      }

      // Auth with session persistence
      this._auth = getAuth(this._app);
      await setPersistence(this._auth, browserLocalPersistence);

      // Storage
      this._storage = getStorage(this._app);

      // Performance monitoring (only in production)
      if (import.meta.env.PROD) {
        this._performance = getPerformance(this._app);
      }

      // Cloud Functions
      this._functions = getFunctions(this._app);
      
      console.log('✅ All Firebase services initialized');
      
    } catch (error) {
      console.error('🚫 Firebase service initialization failed:', error);
      // Individual service failures shouldn't break the whole app
    }
  }

  // Getters with null checks
  get app() {
    if (!this._initialized) {
      console.warn('Firebase: Not initialized. Call initialize() first.');
      return null;
    }
    return this._app;
  }

  get analytics() {
    if (!this._initialized || !this._analytics) {
      console.warn('Firebase Analytics: Not available');
      return null;
    }
    return this._analytics;
  }

  get db() {
    if (!this._initialized || !this._firestore) {
      console.warn('Firestore: Not available');
      return null;
    }
    return this._firestore;
  }

  get auth() {
    if (!this._initialized || !this._auth) {
      console.warn('Firebase Auth: Not available');
      return null;
    }
    return this._auth;
  }

  get storage() {
    if (!this._initialized || !this._storage) {
      console.warn('Firebase Storage: Not available');
      return null;
    }
    return this._storage;
  }

  get performance() {
    if (!this._initialized || !this._performance) {
      console.warn('Firebase Performance: Not available');
      return null;
    }
    return this._performance;
  }

  get functions() {
    if (!this._initialized || !this._functions) {
      console.warn('Firebase Functions: Not available');
      return null;
    }
    return this._functions;
  }

  // Utility methods
  logEvent(eventName, eventParams = {}) {
    if (this._analytics && import.meta.env.PROD) {
      import('firebase/analytics').then(({ logEvent }) => {
        logEvent(this._analytics, eventName, eventParams);
      });
    }
  }

  async getUserDocument(collection, userId) {
    if (!this._firestore) return null;
    
    const { doc, getDoc } = await import('firebase/firestore');
    const userDoc = doc(this._firestore, collection, userId);
    return getDoc(userDoc);
  }
}

// Create and export singleton instance
const firebaseService = new FirebaseService();

// Export individual services for direct imports
export const getFirebaseApp = () => firebaseService.app;
export const getFirestoreDb = () => firebaseService.db;
export const getFirebaseAuth = () => firebaseService.auth;
export const getFirebaseStorage = () => firebaseService.storage;
export const getFirebaseAnalytics = () => firebaseService.analytics;

// Export the service instance for advanced usage
export { firebaseService };

// Initialize Firebase (call this at app startup)
export const initializeFirebase = async () => {
  return await firebaseService.initialize();
};

// Export common Firestore helpers
export const dbHelpers = {
  async addDocument(collection, data) {
    const db = firebaseService.db;
    if (!db) throw new Error('Firestore not initialized');
    
    const { collection: colRef, addDoc } = await import('firebase/firestore');
    return addDoc(colRef(db, collection), data);
  },

  async getDocument(collection, docId) {
    const db = firebaseService.db;
    if (!db) throw new Error('Firestore not initialized');
    
    const { doc, getDoc } = await import('firebase/firestore');
    return getDoc(doc(db, collection, docId));
  },

  async updateDocument(collection, docId, data) {
    const db = firebaseService.db;
    if (!db) throw new Error('Firestore not initialized');
    
    const { doc, updateDoc } = await import('firebase/firestore');
    return updateDoc(doc(db, collection, docId), data);
  },

  async queryCollection(collection, constraints = []) {
    const db = firebaseService.db;
    if (!db) throw new Error('Firestore not initialized');
    
    const { collection: colRef, query, where, getDocs } = await import('firebase/firestore');
    let q = colRef(db, collection);
    
    constraints.forEach(constraint => {
      q = query(q, where(...constraint));
    });
    
    return getDocs(q);
  }
};

// Default export for convenience
export default firebaseService;