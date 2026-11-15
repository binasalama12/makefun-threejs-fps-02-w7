# LAST TRAIN: Subway Interchange

A round-based tactical FPS that runs entirely in the browser, set in a metro
station after the last service has left. You lead the **Signal Crew** — you plus
Alto and Bex — against the four Rustline bots (Vex, Moss, Juno and Pike) who hold
the far end of the platform.

## The objective

Each round starts in the ticket hall with a short buy phase. Cross the platform,
reach the stopped train, and **hold F beside the carriage doors to plant the
charge**. If it goes off, Signal takes the round. Rustline wins the round by
wiping your crew, running the clock out, or defusing the charge at the train —
and either side wins outright by eliminating the other. First crew to six
rounds takes the station.

## Controls

- **WASD** move, **mouse** look (pointer lock), **click** fire
- **R** reload, **Ctrl / C** crouch, **Shift** walk quietly and steady
- **F** plant the charge (hold, inside the yellow zone at the train)
- **G** throw a Flash Pellet, **B** recite the price list
- **1–4** buy or switch weapons during the buy phase, **5** buy a Flash Pellet

## Weapons

Four invented guns, four price points: the cheap **P9 Sidearm** ($300), the
close-range **Gatekeeper Pump** ($900, eight pellets), the all-round **M7
Turnstile Carbine** ($2,400, full auto) and the heavy **Third-Rail Longshot**
($4,200). Kills pay $300, round wins pay $2,900. Accuracy rewards patience:
spread blooms while spraying or moving and shrinks when you stop, crouch and
aim — headshots multiply damage.

## Features

- Original subway map: ticket hall, gates, platform pillars, benches and
  kiosks for cover, sunken tracks and a stopped train, in warning yellow,
  concrete grey and green platform tile, with gently flickering platform lamps
- Bots that patrol waypoints, strafe in fights, check line of sight before
  firing, rush the charge to defuse it, and can be blinded by your flash pellet
- Full HUD: health, cash, round, timer, magazine and reserve, team score and a
  live objective line
- All sound is synthesised with WebAudio — gunfire, planting beeps, the
  detonation — with no audio files and no network requests
- Deterministic screenshot mode via `?shot=start|play|end&seed=N`

## Running it

Serve the `game/` folder with any static file server and open `index.html` in
desktop Chrome. To hand the entry in: `MAKEFUN_OUTPUT_DIR=out node main.ts`.
