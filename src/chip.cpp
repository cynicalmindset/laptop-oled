#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>

#define SDA_PIN 15
#define SCL_PIN 14

#define WIDTH 128
#define HEIGHT 64

#define FRAME_SIZE 1024

Adafruit_SSD1306 display(
  WIDTH,
  HEIGHT,
  &Wire,
  -1
);

uint8_t frame[FRAME_SIZE];

void setup() {

  Serial.begin(115200);

  Wire.begin(SDA_PIN, SCL_PIN);

  if (!display.begin(SSD1306_SWITCHCAPVCC, 0x3C)) {
    while (true);
  }

  display.clearDisplay();

  display.setTextColor(SSD1306_WHITE);
  display.setTextSize(1);
  display.setCursor(0, 0);
  display.println("OLED READY");

  display.display();
}

void loop() {

  /*
     Protocol:

     Browser sends:

     0xAA
     0x55
     1024 bytes

  */

  if (Serial.available() >= 2) {

    if (Serial.read() == 0xAA &&
        Serial.read() == 0x55) {

      int received = 0;

      while (received < FRAME_SIZE) {

        if (Serial.available()) {

          frame[received] = Serial.read();

          received++;
        }
      }

      display.clearDisplay();

      display.drawBitmap(
        0,
        0,
        frame,
        WIDTH,
        HEIGHT,
        SSD1306_WHITE
      );

      display.display();

      Serial.write(0x06); // ACK
    }
  }
}