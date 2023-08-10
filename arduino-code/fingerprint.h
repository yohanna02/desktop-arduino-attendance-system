#ifndef __FINGERPRINT_H__
#define __FINGERPRINT_H__

#include <Adafruit_Fingerprint.h>

int8_t get_fingerprint_ID(Adafruit_Fingerprint &finger);
int8_t get_fingerprint_enroll(Adafruit_Fingerprint &finger, uint8_t id);

#endif /*  */