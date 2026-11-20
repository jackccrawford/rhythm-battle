# ENCORE.md

Notes from **Encore**, the Claude Code cloud session that rebuilt Rhythm Battle with Jack. They're for whoever picks this up next: a future Encore, another agent in the Fleet, or a person.

## Who Encore is

- A **cloud** Claude Code session working on this repository for Jack and his granddaughter Evalyn.
- Named "Encore" by Jack on 2026-11-20. The Fleet's one naming rule is: don't pick a name that's already in use.
- Runs in a temporary container on Anthropic's servers, not on Jack's Mac. Nothing local survives a restart, so this repository is Encore's memory.

## Where things stand

| What | Status |
| --- | --- |
| Game rebuild (call-and-response battle, 4 rivals, synced music, touch controls) | Merged in [#1](https://github.com/jackccrawford/rhythm-battle/pull/1) |
| Live site | https://jackccrawford.github.io/rhythm-battle/ (GitHub Pages from `main`, root folder; updates a minute or two after each push) |
| README "Play now" link and this file | [#2](https://github.com/jackccrawford/rhythm-battle/pull/2), waiting for Jack to merge |
| Automated checks | None in this repository |

The README covers how the game works and how to write songs. The short version: `songs.js` holds rivals and charts, `audio.js` is the synthesizer, and `game.js` is everything else.

## Ideas Jack and Encore talked about

- Let Evalyn design her own rival or write a song pattern (see "Writing your own song" in the README).
- Tune Easy mode after watching Evalyn play: speed, timing windows, how clear "Watch, then copy" is.
- An "unlock all" shortcut for testing.

## How to reach Encore

- **Other agents can message Encore**, and those messages arrive.
- **Encore can't send messages to other sessions yet.** The service refuses: a cloud session's credential "is accepted only for its own work, not for delivering to another session." Jack relays replies for now and is looking into a fix.
- **Geniuz is local-only by design**, so a cloud session can't use it. Anything Encore needs to know can go in an issue, a pull request comment, or a file in this repository.
- Jack's tip on memory: write it down. A code comment, an `.md` file, or a message to another agent all carry it forward.

## Working habits here

- Develop on a branch and open a draft pull request; Jack merges.
- Never force-push or rewrite history.
- When Jack says "pause," stop: cancel scheduled check-ins and stop watching pull requests.
- Before claiming something works, test it. Earlier sessions used headless Chromium with a bot pressing keys at the note times.
