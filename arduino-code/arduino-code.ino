#include <ESP8266WiFi.h>
#include <ESP8266HTTPClient.h>
#include <ArduinoWebsockets.h>
#include <ArduinoJson.h>
#include <SoftwareSerial.h>
#include "fingerprint.h"
#include "utils.h"

SoftwareSerial fingerSerial(D5, D6);

Adafruit_Fingerprint finger = Adafruit_Fingerprint(&fingerSerial);

websockets::WebsocketsClient socket_client;

MODE current_mode = MODE::NONE;

String IP = "192.168.0.102";
uint16_t PORT = 3000;

String socket_uuid = "";

void onMessageCallback(websockets::WebsocketsMessage message) {
  Serial.print("Got Message: ");
  Serial.println(message.data());
}

void setup() {
  Serial.begin(115200);
  finger.begin(57600);
  if (!finger.verifyPassword()) {
    Serial.println(F("Fingerprint Sensor not connected"));
    Serial.println(F("Check connection please"));
    Serial.println(F("Restart system to continue please"));
    while (1) {
      delay(0);
    }
  }
  print_menu();

  socket_client.onMessage(onMessageCallback);
}

void loop() {
  while (current_mode == MODE::NONE) {
    // Serial.println(F("Waiting for command..."));
    if (Serial.available()) {
      int command = Serial.parseInt();
      Serial.println(command);
      if (command == 1) {
        current_mode = MODE::CONNECT_WIFI;
      } else if (command == 2) {
        current_mode = MODE::ENROLL_FINGER;
      } else if (command == 3) {
        current_mode = MODE::TAKE_ATTENDANCE;
      } else if (command == 4) {
        current_mode = MODE::ENTER_IP;
      }

      Serial.readString();
    }
  }
  bool once = true;
  while (current_mode == MODE::CONNECT_WIFI) {
    if (once) {
      once = false;
      Serial.println(F("Enter WiFi Credentials e.g. <wifi-name>@<wifi-password>"));
    }
    if (Serial.available()) {
      char terminate = Serial.peek();
      if (terminate == '.') {
        current_mode = MODE::NONE;
        Serial.readString();
        print_menu();
        break;
      }

      String SSID = Serial.readStringUntil('@');
      String password = Serial.readStringUntil('\n');
      Serial.readString();
      SSID.trim();
      password.trim();

      WiFi.mode(WIFI_STA);
      WiFi.begin(SSID, password);
      unsigned long timer = millis();
      while (WiFi.status() != WL_CONNECTED && millis() - timer < 10000) {
        Serial.print(F("."));
        delay(1000);
      }

      if (WiFi.status() == WL_CONNECTED) {
        Serial.println("Connected to " + String(SSID));
        if (!socket_client.connect(IP, PORT, "/")) {
          Serial.println(F("Failed to connect to web socket server"));
        } else {
          Serial.println(F("Connected to web socket server"));
          if (socket_client.send("{\"event\":\"set-device\",\"device\":\"esp\"}")) {
            Serial.println(F("Set device Successfully"));
          }
          else {
            Serial.println(F("Error setting device"));
          }
        }
        current_mode = MODE::NONE;
      } else if (WiFi.status() != WL_CONNECTED) {
        Serial.println("Unable to connected to " + String(SSID));
        once = true;
      }
    }
  }

  while (current_mode == MODE::ENTER_IP) {
    if (once) {
      Serial.println(F("Enter IP address of the server"));
      once = false;
    }

    if (Serial.available()) {
      IP = Serial.readString();
      Serial.print(F("IP Address set to "));
      Serial.print(IP);
      print_menu();
      current_mode = MODE::NONE;
    }
  }

  while (current_mode == MODE::ENROLL_FINGER) {
    WiFiClient client;
    HTTPClient http;
    // current_mode = MODE::NONE;

    Serial.println(F("\n*******Class List*******"));
    if (http.begin(client, IP, PORT, "/api/class?select=name")) {
      int http_code = http.GET();

      if (http_code > 0) {
        if (http_code == HTTP_CODE_OK) {
          String payload = http.getString();
          // Enough space for:
          // + 1 object with 3 members
          // + 2 objects with 1 member
          const int capacity = JSON_OBJECT_SIZE(2) + 2 * JSON_OBJECT_SIZE(10);
          DynamicJsonDocument doc(capacity);
          DeserializationError error = deserializeJson(doc, payload);
          if (error) {
            Serial.print(F("deserializeJson() failed: "));
            Serial.println(error.f_str());
            current_mode = MODE::NONE;
          } else {
            http.end();
            int size = doc["size"];
            for (int i = 0; i < size; i++) {
              const char* class_name = doc["classes"][i]["name"];
              Serial.println(String(i + 1) + ". " + String(class_name));
            }

            while (1) {
              if (Serial.available()) {
                int option = Serial.parseInt();
                Serial.readString();
                if (option == 0 || option > size) {
                  Serial.println(F("Invalid option"));
                  continue;
                }

                const char* class_name = doc["classes"][option - 1]["name"];
                Serial.print(F("Selected "));
                Serial.println(class_name);

                Serial.println(F("\nEnter ID from 1 - 127"));
                while (Serial.available() == 0)
                  ;
                uint8_t id = Serial.parseInt();
                Serial.readString();

                if (http.begin(client, IP, PORT, "/api/verify-id?id=" + String(id))) {
                  int http_code = http.GET();

                  if (http_code > 0) {
                    if (http_code == HTTP_CODE_OK) {
                      String payload = http.getString();

                      DynamicJsonDocument doc(100);
                      DeserializationError error = deserializeJson(doc, payload);
                      if (error) {
                        Serial.print(F("deserializeJson() failed: "));
                        Serial.println(error.f_str());
                        current_mode = MODE::NONE;
                      } else {
                        const char* data = doc["data"];

                        if (String(data) == "found") {
                          Serial.println(F("ID already in use"));
                          current_mode = MODE::NONE;
                          break;
                        } else {
                          if (get_fingerprint_enroll(finger, id) == FINGERPRINT_OK) {
                            if (socket_client.send("{\"event\":\"enroll\",\"id\":" + String(id) + "}")) {
                              Serial.println(F("\n\nEnrolled successfully, continue from the desktop app"));
                            }
                            else {
                              Serial.println(F("\n\nError communicating with server"));
                            }
                          }
                          else {
                            Serial.println(F("\n\nError Enrolling finger"));
                          }
                          current_mode = MODE::NONE;
                          break;
                        }
                      }
                    }
                  }  else {
                    Serial.println(F("Error fetch data"));
                    current_mode = MODE::NONE;
                    break;
                  }
                } else {
                  Serial.println(F("Unable to connect"));
                  current_mode = MODE::NONE;
                  break;
                }
              }
            }
          }
        }
      } else {
        Serial.println(F("Unable to connect"));
        current_mode = MODE::NONE;
      }
    }
  }

  while (current_mode == MODE::TAKE_ATTENDANCE) {
    WiFiClient client;
    HTTPClient http;
    Serial.println(F("\n*******Class List*******"));
    if (http.begin(client, IP, PORT, "/api/class?select=name")) {
      int http_code = http.GET();

      if (http_code > 0) {
        if (http_code == HTTP_CODE_OK) {
          const String& payload = http.getString();
          // Enough space for:
          // + 1 object with 3 members
          // + 2 objects with 1 member
          const int capacity = JSON_OBJECT_SIZE(2) + 2 * JSON_OBJECT_SIZE(10);
          DynamicJsonDocument doc(capacity);
          DeserializationError error = deserializeJson(doc, payload);
          if (error) {
            Serial.print(F("deserializeJson() failed: "));
            Serial.println(error.f_str());
            current_mode = MODE::NONE;
          } else {
            http.end();
            int size = doc["size"];
            for (int i = 0; i < size; i++) {
              const char* class_name = doc["classes"][i]["name"];
              Serial.println(String(i + 1) + ". " + String(class_name));
            }

            while (1) {
              if (Serial.available()) {
                int option = Serial.parseInt();
                Serial.readString();
                if (option == 0 || option > size) {
                  Serial.println(F("Invalid option"));
                  continue;
                }

                const char* class_name = doc["classes"][option - 1]["name"];
                Serial.print(F("Selected "));
                Serial.println(class_name);

                Serial.println(F("Place finger"));

                int8_t finger_id = 0;
                while ((finger_id = get_fingerprint_ID(finger)) == -1);
                Serial.println(finger_id);
                if (finger_id == -2) {
                  Serial.println(F("Fingerprint not found"));
                  current_mode = MODE::NONE;
                  break;
                }
                else {
                  if (http.begin(client, IP, PORT, "/api/take-attendance")) {
                    http.addHeader("Content-Type", "application/json");
                    DynamicJsonDocument json_doc(200);
                    json_doc["fingerprintId"] = finger_id;
                    json_doc["classId"] = doc["classes"][option - 1]["_id"];
                    String json;
                    serializeJson(json_doc, json);
                    int http_code = http.POST(json);
                    if (http_code == HTTP_CODE_OK) {
                      const String& payload = http.getString();

                      Serial.println(payload);
                      current_mode = MODE::NONE;
                      break;
                    }
                    else {
                      Serial.println(F("Error taking attendance"));
                      current_mode = MODE::NONE;
                      break;
                    }
                  }
                  else {
                    Serial.println(F("Could'nt connect"));
                    current_mode = MODE::NONE;
                    break;
                  }
                }
              }
            }
          }
        }
        else {
          Serial.println(F("Could'nt connect"));
          current_mode = MODE::NONE;
        }
      }
      else {
        Serial.println(F("Could'nt connect"));
        current_mode = MODE::NONE;
      }
    }
  }

  Serial.println();
  print_menu();
}
