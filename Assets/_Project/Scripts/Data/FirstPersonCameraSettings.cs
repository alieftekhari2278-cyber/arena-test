using UnityEngine;

namespace TacticalFPS.Data
{
    [CreateAssetMenu(menuName = "TacticalFPS/Player/Camera Settings", fileName = "FirstPersonCameraSettings")]
    public sealed class FirstPersonCameraSettings : ScriptableObject
    {
        [Header("Look")]
        [SerializeField, Min(0.001f)] private float mouseSensitivity = 0.075f;
        [SerializeField] private bool invertY;
        [SerializeField, Range(-89f, -1f)] private float minimumPitch = -eightyFive;
        [SerializeField, Range(1f, 89f)] private float maximumPitch = eightyFive;

        [Header("Field of view")]
        [SerializeField, Range(40f, 110f)] private float normalFieldOfView =  fieldOfViewDefault;
        [SerializeField, Range(40f, 120f)] private float sprintFieldOfView =  fieldOfViewSprint;
        [SerializeField, Min(0.01f)] private float fieldOfViewSmoothTime = 0.12f;

        [Header("Camera bob")]
        [SerializeField] private bool enableCameraBob = true;
        [SerializeField, Min(0f)] private float bobFrequency = 8.5f;
        [SerializeField] private Vector2 bobAmplitude = new Vector2(0.018f, 0.025f);

        public float MouseSensitivity => mouseSensitivity;
        public bool InvertY => invertY;
        public float MinimumPitch => minimumPitch;
        public float MaximumPitch => maximumPitch;
        public float NormalFieldOfView => normalFieldOfView;
        public float SprintFieldOfView => sprintFieldOfView;
        public float FieldOfViewSmoothTime => fieldOfViewSmoothTime;
        public bool EnableCameraBob => enableCameraBob;
        public float BobFrequency => bobFrequency;
        public Vector2 BobAmplitude => bobAmplitude;

        // Named constants keep the default values readable in the inspector declaration.
        private const float eightyFive = 85f;
        private const float fieldOfViewDefault = 75f;
        private const float fieldOfViewSprint = 80f;
    }
}
