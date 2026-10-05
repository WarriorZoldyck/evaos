import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const supabaseUrl = 'https://rrrnnrjefyffllnrwhkz.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJycm5ucmplZnlmZmxsbnJ3aGt6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA5NjQ4NjksImV4cCI6MjA2NjU0MDg2OX0.1YgMkSGAvo-1zY9RtI7M9zau1mBGLksxRLHLD3vaaZA';
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log("Checking user email...");
  // We can't query auth.users with anon key, but we can query user_profiles
  const { data: profiles, error: err } = await supabase.from('user_profiles').select('*').limit(10);
  console.log(profiles, err);
}

main();
