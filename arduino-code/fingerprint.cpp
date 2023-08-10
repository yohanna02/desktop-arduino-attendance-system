#include "c_types.h"
#include "fingerprint.h"

/**
 * get_fingerprint_ID - scan finger and return ID
 * @finger: finger object from adafruit
 * Return: -1 if failed, -2 if not found, otherwise ID
 */
int8_t get_fingerprint_ID(Adafruit_Fingerprint &finger) {
  uint8_t p = finger.getImage();
  if (p != FINGERPRINT_OK)
    return -1;

  p = finger.image2Tz();
  if (p != FINGERPRINT_OK)
    return -1;

  p = finger.fingerFastSearch();
  if (p == FINGERPRINT_NOTFOUND)
    return -2;
  if (p != FINGERPRINT_OK)
    return -1;

  return finger.fingerID;
}

/**
 * get_fingerprint_enroll - Enrolls a fingerprint
 * @finger: finger object from adafruit
 * @id: finerprint ID to enroll
 * Return: FINGERPRINT_OK if enrolled
 */
int8_t get_fingerprint_enroll(Adafruit_Fingerprint &finger, uint8_t id) {
  int p = FINGERPRINT_NOFINGER;
  Serial.print("Place Finger");
  while (p != FINGERPRINT_OK) {
    p = finger.getImage();
    switch (p) {
      case FINGERPRINT_OK:
        Serial.print("Finger taken");
        break;
      case FINGERPRINT_NOFINGER:
        break;
      case FINGERPRINT_PACKETRECIEVEERR:
        Serial.print("Communication error");
        break;
      case FINGERPRINT_IMAGEFAIL:
        Serial.print("Imaging error");
        break;
      default:
        Serial.print("Unknown error");
        break;
    }
  }

  // OK success!

  p = finger.image2Tz(1);
  switch (p) {
    case FINGERPRINT_OK:
      Serial.println("Image converted");
      break;
    case FINGERPRINT_IMAGEMESS:
      Serial.println("Image too messy");
      return p;
    case FINGERPRINT_PACKETRECIEVEERR:
      Serial.println("Communication error");
      return p;
    case FINGERPRINT_FEATUREFAIL:
      Serial.println("Could not find fingerprint features");
      return p;
    case FINGERPRINT_INVALIDIMAGE:
      Serial.println("Could not find fingerprint features");
      return p;
    default:
      Serial.println("Unknown error");
      return p;
  }

  Serial.print("Remove finger");
  delay(3000);
  Serial.print("Place same finger");
  p = 0;
  while (p != FINGERPRINT_NOFINGER) {
    p = finger.getImage();
  }
  p = -1;
  while (p != FINGERPRINT_OK) {
    p = finger.getImage();
    switch (p) {
      case FINGERPRINT_OK:
        Serial.print("Finger taken");
        break;
      case FINGERPRINT_NOFINGER:
        break;
      case FINGERPRINT_PACKETRECIEVEERR:
        Serial.print("Communication error");
        break;
      case FINGERPRINT_IMAGEFAIL:
        Serial.print("Imaging error");
        break;
      default:
        Serial.print("Unknown error");
        break;
    }
  }

  // OK success!

  p = finger.image2Tz(2);
  switch (p) {
    case FINGERPRINT_OK:
      Serial.println("Image converted");
      break;
    case FINGERPRINT_IMAGEMESS:
      Serial.println("Image too messy");
      return p;
    case FINGERPRINT_PACKETRECIEVEERR:
      Serial.println("Communication error");
      return p;
    case FINGERPRINT_FEATUREFAIL:
      Serial.println("Could not find fingerprint features");
      return p;
    case FINGERPRINT_INVALIDIMAGE:
      Serial.println("Could not find fingerprint features");
      return p;
    default:
      Serial.println("Unknown error");
      return p;
  }

  // OK converted!

  p = finger.createModel();
  if (p == FINGERPRINT_OK) {
    Serial.print("Prints matched");

  } else if (p == FINGERPRINT_PACKETRECIEVEERR) {
    Serial.print("Communication error");
    return p;
  } else if (p == FINGERPRINT_ENROLLMISMATCH) {
    Serial.print("Finger did not match");
    return p;
  } else {
    Serial.print("Unknown error");
    return p;
  }

  p = finger.storeModel(id);
  if (p == FINGERPRINT_OK) {
    Serial.print("Stored!");
    delay(3000);
  } else if (p == FINGERPRINT_PACKETRECIEVEERR) {
    Serial.print("Communication error");
    return p;
  } else if (p == FINGERPRINT_BADLOCATION) {
    Serial.print("Bad location");
    return p;
  } else if (p == FINGERPRINT_FLASHERR) {
    Serial.print("Error writing");
    return p;
  } else {
    Serial.print("Unknown error");
    delay(3000);
    return p;
  }

  return FINGERPRINT_OK;
}