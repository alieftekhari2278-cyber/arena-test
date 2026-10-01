using System;
using UnityEngine;

namespace TacticalFPS.Core
{
    /// <summary>
    /// Minimal application/session coordinator for the vertical slice.
    /// Round simulation will subscribe to this lifecycle instead of owning bootstrapping.
    /// </summary>
    public sealed class GameManager : MonoBehaviour
    {
        public static GameManager Instance { get; private set; }

        [SerializeField]
        private bool autoStartSession = true;

        public bool IsSessionActive { get; private set; }

        public event Action SessionStarted;
        public event Action SessionStopped;

        private void Awake()
        {
            if (Instance != null && Instance != this)
            {
                Destroy(gameObject);
                return;
            }

            Instance = this;
            DontDestroyOnLoad(gameObject);
        }

        private void Start()
        {
            if (autoStartSession)
            {
                StartSession();
            }
        }

        public void StartSession()
        {
            if (IsSessionActive)
            {
                return;
            }

            IsSessionActive = true;
            SessionStarted?.Invoke();
        }

        public void StopSession()
        {
            if (!IsSessionActive)
            {
                return;
            }

            IsSessionActive = false;
            SessionStopped?.Invoke();
        }

        private void OnDestroy()
        {
            if (Instance != this)
            {
                return;
            }

            StopSession();
            Instance = null;
        }
    }
}
