import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Missing Supabase credentials in .env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function resetPassword() {
  console.log("Triggering password reset for docesgourmetnb@gmail.com...");
  const { data, error } = await supabase.auth.resetPasswordForEmail('docesgourmetnb@gmail.com', {
    redirectTo: window?.location?.origin + '/reset-password',
  });

  if (error) {
    console.error("Error reseting password:", error.message);
  } else {
    console.log("Success! Password reset email sent. Data:", data);
  }
}

resetPassword();
