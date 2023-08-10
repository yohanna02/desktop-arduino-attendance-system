#include "utils.h"

void print_menu() {
  Serial.println(F("*******MENU*******"));
  Serial.println(F("1. Connect to Wifi"));
  Serial.println(F("2. Enroll Finger"));
  Serial.println(F("3. Take Attendance"));
  Serial.println(F("4. Enter IP Address"));
}