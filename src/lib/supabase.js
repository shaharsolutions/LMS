import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

// Safety check for environments without Vite (like VS Code Live Server / GitHub Pages)
const env = import.meta.env || {}
const supabaseUrl = env.VITE_SUPABASE_URL || 'https://czfjbmkjnodonmtjvwep.supabase.co'
const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN6ZmpibWtqbm9kb25tdGp2d2VwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI5NjA5MzQsImV4cCI6MjA4ODUzNjkzNH0.R8syO-AS9CcIrP3tYBFO9PTs388UG7rs6SCoVx1Sb4A'

// This initializes the Supabase client
export const supabase = (supabaseUrl && supabaseAnonKey) 
  ? createClient(supabaseUrl, supabaseAnonKey) 
  : null;

if (supabase) {
  console.log("✅ Supabase Connected Successfully");
} else {
  console.warn("⚠️ Supabase Client is NULL - Running in Mock Mode. Please restart Vite server.");
}
