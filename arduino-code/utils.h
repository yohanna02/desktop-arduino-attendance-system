#ifndef __UTILS_H__
#define __UTILS_H__

#include <Arduino.h>

enum class MODE {
  NONE,
  CONNECT_WIFI,
  ENROLL_FINGER,
  TAKE_ATTENDANCE,
  ENTER_IP
};

void print_menu();

#endif /* __UTILS_H__ */