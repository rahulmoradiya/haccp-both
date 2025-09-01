import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { app } from '../firebase';

export interface SignInData {
  email: string;
  password: string;
}

export interface SignInResult {
  success: boolean;
  error?: string;
  user?: any;
}

export const validateSignInData = (data: SignInData): string | null => {
  if (!data.email || !data.password) {
    return 'Please enter both email and password.';
  }
  
  // Basic email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(data.email)) {
    return 'Please enter a valid email address.';
  }
  
  return null;
};

export const authenticateUser = async (data: SignInData): Promise<SignInResult> => {
  try {
    // Validate input data
    const validationError = validateSignInData(data);
    if (validationError) {
      return {
        success: false,
        error: validationError
      };
    }
    
    // Authenticate user
    const auth = getAuth(app);
    const userCredential = await signInWithEmailAndPassword(auth, data.email, data.password);
    
    console.log('✅ Sign in successful for user:', userCredential.user.uid);
    
    return {
      success: true,
      user: userCredential.user
    };
    
  } catch (error: any) {
    console.error('❌ Sign in failed:', error);
    
    // Handle specific Firebase errors
    let errorMessage = 'Sign in failed. Please try again.';
    
    if (error.code === 'auth/user-not-found') {
      errorMessage = 'No account found with this email address.';
    } else if (error.code === 'auth/wrong-password') {
      errorMessage = 'Incorrect password. Please try again.';
    } else if (error.code === 'auth/invalid-email') {
      errorMessage = 'Please enter a valid email address.';
    } else if (error.code === 'auth/too-many-requests') {
      errorMessage = 'Too many failed attempts. Please try again later.';
    } else if (error.message) {
      errorMessage = error.message;
    }
    
    return {
      success: false,
      error: errorMessage
    };
  }
};

export const clearSignInForm = () => {
  // This function can be used to clear form data if needed
  return {
    email: '',
    password: ''
  };
};
