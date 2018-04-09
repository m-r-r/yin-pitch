const DEFAULT_THRESHOLD = 0.2;

/**
 * Detect the fundamental frequency of an audio signal.
 *
 * This class is an implementation of the [YIN algorithm](http://audition.ens.fr/adc/pdf/2002_JASA_YIN.pdf).
 */
export class Yin {
  /**
   * Create a new instance
   * @param {number} bufferLength Length of the input buffer. Must be an even number.
   * @param {number} sampleRate The sample rate of the signal
   * @param {number} [threshold] The YIN threshold (default: 20%)
   */
  constructor(bufferLength, sampleRate, threshold = DEFAULT_THRESHOLD) {
    if (bufferLength & 1) {
      throw new TypeError("The buffer length must be a multiple of two");
    }
    if (sampleRate <= 0 || !Number.isSafeInteger(sampleRate)) {
      throw new TypeError("The sample rate must be a positive integer");
    }
    if (typeof threshold !== "number" || threshold <= 0 || threshold >= 1) {
      throw new TypeError(
        "The threshold must be a positive number between 0 and 1"
      );
    }

    this._bufferLength = bufferLength;
    this._sampleRate = sampleRate;
    this._threshold = threshold;

    this._yinBuffer = new Float32Array(bufferLength / 2);

    Object.freeze(this);
  }

  /**
   * Estimate the fundamental frequency of a signal.
   * @param {Float32Array} data An array of samples
   * @return {number|null} The fundamental frequency in Hertz, or -1 if the frequency could not be estimated
   */
  getPitch(data) {
    if (data.length !== this._bufferLength) {
      throw new TypeError("Incorrect buffer size");
    }
    this._asf(data);
    const period = this._estimatePeriod();
    if (period !== null) {
      return this._sampleRate / period;
    }
    return -1;
  }

  _asf(data) {
    let total = 0;

    // Step 1 : auto-correlation function
    this._yinBuffer[0] = 1;
    for (let tau = 1; tau < this._yinBuffer.length; tau++) {
      let sum = 0;
      for (let index = 0; index < this._yinBuffer.length; index++) {
        // Step 2 : the delta is squared to reduce the error rate
        sum += (data[index] - data[index + tau]) ** 2;
      }
      // Step 3 : cumulative mean normalized difference
      total += sum;
      this._yinBuffer[tau] = sum * (tau / total);
    }
  }

  _estimatePeriod() {
    // Step 4 : absolute threshold
    const maxLag = this._yinBuffer.length - 1;

    let tau = 2;
    // Until the error rate is below the threshold :
    while (tau < maxLag && this._yinBuffer[tau] >= this._threshold) {
      tau++; // Increment the lag
    }
    // Find lowest possible value of the lag to avoid octave errors
    while (tau < maxLag && this._yinBuffer[tau + 1] < this._yinBuffer[tau]) {
      tau++;
    }

    // Step 5 : Calculate the parabolic interpolation :
    const delta = this._yinBuffer[tau - 1] - this._yinBuffer[tau + 1];
    const den = this._yinBuffer[tau + 1] - 2 * this._yinBuffer[tau] + this._yinBuffer[tau - 1];
    return den === 0 ? tau : tau + delta / (2 * den);
  }
}
