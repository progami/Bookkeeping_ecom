# 🚀 Simple Logging System

## How It Works

When you run `npm run dev`, it automatically:
- Shows all logs in the console (just like before)
- ALSO saves everything to a log file in `logs/` directory
- Creates a new log file each time you start the server

## Starting the Server

```bash
# Just use normal npm run dev
npm run dev

# That's it! Logs appear in console AND are saved to files
```

## Viewing Logs

```bash
# Show the latest log file
./show-logs.sh

# Follow logs in real-time (like tail -f)
./show-logs.sh -f
```

## Log Files

- Location: `logs/` directory
- Format: `app-2025-06-16-11-45-00.log`
- New file each time you start the server

## That's It!

No complex setup. Just:
1. Run `npm run dev` 
2. Use the app
3. Tell me "check the logs"
4. I run `./show-logs.sh` to see what happened

Everything you see in the console is also saved to the log file!