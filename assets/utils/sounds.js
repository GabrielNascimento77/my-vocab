(function() {
  MyVocab.utils.sounds = {
    play(type) {
      try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        const audioCtx = new AudioContext();
        
        const playTone = (frequency, duration, type = 'sine') => {
          const oscillator = audioCtx.createOscillator();
          const gainNode = audioCtx.createGain();
          
          oscillator.connect(gainNode);
          gainNode.connect(audioCtx.destination);
          
          oscillator.type = type;
          oscillator.frequency.setValueAtTime(frequency, audioCtx.currentTime);
          
          gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
          gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);
          
          oscillator.start();
          oscillator.stop(audioCtx.currentTime + duration);
        };
        
        if (type === 'correct') {
          playTone(523.25, 0.1);
          setTimeout(() => playTone(659.25, 0.1), 100);
          setTimeout(() => playTone(783.99, 0.2), 200);
        } else if (type === 'wrong') {
          playTone(220.00, 0.15, 'sawtooth');
          setTimeout(() => playTone(196.00, 0.15, 'sawtooth'), 150);
        }
      } catch (e) {
        console.log('Áudio não suportado:', e);
      }
    },

    createXPFloat(x, y, amount = 10) {
      const float = document.createElement('div');
      float.className = 'myvocab__xpFloat';
      float.textContent = `+${amount} XP`;
      float.style.left = `${x}px`;
      float.style.top = `${y}px`;
      float.style.position = 'fixed';
      float.style.zIndex = '9999';
      document.body.appendChild(float);
      
      setTimeout(() => float.remove(), 1500);
    }
  };
})();
