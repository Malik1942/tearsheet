/** The phone around a shell (device frame spec 2026-11-04): an iPhone 15/16 Pro's shape at 320 pt wide, measured off the hi-fi bezel Malik supplied (its screen
 *  scaled to 320 is 320 × 696 with corners of about 50, a 75 × 29 island 11 below the top, about 12 of glass edge and metal). A 19.5:9 screen with 50 px
 *  corners in a 10 px bezel, and a 75 × 28 Dynamic Island. PhoneFrame (Device.tsx) draws it; shell.css holds the same numbers. */
export const PHONE = { screenW: 320, screenH: 694, bezel: 10, screenRadius: 50, islandW: 75, islandH: 28, islandTop: 11 } as const
export const PHONE_W = PHONE.screenW + 2 * PHONE.bezel, PHONE_H = PHONE.screenH + 2 * PHONE.bezel
