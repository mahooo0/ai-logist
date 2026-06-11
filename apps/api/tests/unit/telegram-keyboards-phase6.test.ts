// Phase 6 Wave 1 — live tests for loadingKeyboard + deliveryKeyboard.
// Decision: D-08
// Plan: 06-01 Wave 1
import { describe, it, expect } from 'vitest';
import { loadingKeyboard, deliveryKeyboard } from '../../src/channels/telegram/keyboards.js';

describe('telegram-keyboards-phase6', () => {
  describe('loadingKeyboard RU', () => {
    it('has 2 rows with 1 button each', () => {
      const kbd = loadingKeyboard('abc-123', 'ru');
      expect(kbd.inline_keyboard).toHaveLength(2);
      expect(kbd.inline_keyboard[0]).toHaveLength(1);
      expect(kbd.inline_keyboard[1]).toHaveLength(1);
    });

    it('first button text is RU confirm label', () => {
      const kbd = loadingKeyboard('abc-123', 'ru');
      expect(kbd.inline_keyboard[0][0].text).toBe('✅ Да, подтверждаю');
    });

    it('first button callback_data is confirm_loading:<orderId>', () => {
      const kbd = loadingKeyboard('abc-123', 'ru');
      expect(kbd.inline_keyboard[0][0].callback_data).toBe('confirm_loading:abc-123');
    });

    it('second button text is RU decline label', () => {
      const kbd = loadingKeyboard('abc-123', 'ru');
      expect(kbd.inline_keyboard[1][0].text).toBe('⚠️ Нет, есть проблема');
    });

    it('second button callback_data is decline_loading:<orderId>', () => {
      const kbd = loadingKeyboard('abc-123', 'ru');
      expect(kbd.inline_keyboard[1][0].callback_data).toBe('decline_loading:abc-123');
    });
  });

  describe('loadingKeyboard UA', () => {
    it('first button text is UA confirm label', () => {
      const kbd = loadingKeyboard('abc-123', 'ua');
      expect(kbd.inline_keyboard[0][0].text).toBe('✅ Так, підтверджую');
    });

    it('second button text is UA decline label', () => {
      const kbd = loadingKeyboard('abc-123', 'ua');
      expect(kbd.inline_keyboard[1][0].text).toBe('⚠️ Ні, є проблема');
    });

    it('callback_data uses orderId regardless of lang', () => {
      const kbd = loadingKeyboard('xyz-999', 'ua');
      expect(kbd.inline_keyboard[0][0].callback_data).toBe('confirm_loading:xyz-999');
      expect(kbd.inline_keyboard[1][0].callback_data).toBe('decline_loading:xyz-999');
    });
  });

  describe('deliveryKeyboard RU', () => {
    it('has 2 rows with 1 button each', () => {
      const kbd = deliveryKeyboard('order-uuid', 'ru');
      expect(kbd.inline_keyboard).toHaveLength(2);
    });

    it('first button callback_data is confirm_delivery:<orderId>', () => {
      const kbd = deliveryKeyboard('order-uuid', 'ru');
      expect(kbd.inline_keyboard[0][0].callback_data).toBe('confirm_delivery:order-uuid');
    });

    it('second button callback_data is decline_delivery:<orderId>', () => {
      const kbd = deliveryKeyboard('order-uuid', 'ru');
      expect(kbd.inline_keyboard[1][0].callback_data).toBe('decline_delivery:order-uuid');
    });
  });

  describe('deliveryKeyboard UA', () => {
    it('first button text is UA confirm label', () => {
      const kbd = deliveryKeyboard('order-uuid', 'ua');
      expect(kbd.inline_keyboard[0][0].text).toBe('✅ Так, отримав');
    });

    it('second button text is UA decline label', () => {
      const kbd = deliveryKeyboard('order-uuid', 'ua');
      expect(kbd.inline_keyboard[1][0].text).toBe('⚠️ Ні, є проблема');
    });
  });
});
