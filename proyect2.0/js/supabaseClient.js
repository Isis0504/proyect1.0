// js/supabaseClient.js
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = "https://sovycapooewzydwpkbue.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNvdnljYXBvb2V3enlkd3BrYnVlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA5NzIzMzYsImV4cCI6MjA3NjU0ODMzNn0.RCmSVd5k4KxdGpaR52so4uz9Sv_7mn1rBytsK2l9J4k";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
