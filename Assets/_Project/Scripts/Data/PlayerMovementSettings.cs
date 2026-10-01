using UnityEngine;

namespace TacticalFPS.Data
{
    [CreateAssetMenu(menuName = "TacticalFPS/Player/Movement Settings", fileName = "PlayerMovementSettings")]
    public sealed class PlayerMovementSettings : ScriptableObject
    {
        [Header("Horizontal movement")]
        [SerializeField, Min(0f)] private float walkSpeed = 3.2f;
        [SerializeField, Min(0f)] private float runSpeed = 5.2f;
        [SerializeField, Min(0f)] private float sprintSpeed = 6.8f;
        [SerializeField, Min(0f)] private float crouchSpeed = 2.1f;
        [SerializeField, Min(0f)] private float groundAcceleration = 28f;
        [SerializeField, Min(0f)] private float groundDeceleration = 34f;

        [Header("Vertical movement")]
        [SerializeField, Min(0f)] private float jumpHeight = 1.05f;
        [SerializeField] private float gravity = -24f;
        [SerializeField] private float groundedDownForce = -2f;

        [Header("Capsule")]
        [SerializeField, Min(0.2f)] private float standingHeight = 1.8f;
        [SerializeField, Min(0.2f)] private float crouchingHeight = 1.15f;
        [SerializeField, Min(0.05f)] private float capsuleRadius = 0.34f;
        [SerializeField, Min(0.01f)] private float crouchTransitionSpeed = 12f;
        [SerializeField, Min(0.05f)] private float groundCheckRadius = 0.2f;
        [SerializeField] private float groundCheckOffset = 0.08f;

        [Header("View heights")]
        [SerializeField, Min(0.2f)] private float standingViewHeight = 1.62f;
        [SerializeField, Min(0.2f)] private float crouchingViewHeight = 0.96f;

        public float WalkSpeed => walkSpeed;
        public float RunSpeed => runSpeed;
        public float SprintSpeed => sprintSpeed;
        public float CrouchSpeed => crouchSpeed;
        public float GroundAcceleration => groundAcceleration;
        public float GroundDeceleration => groundDeceleration;
        public float JumpHeight => jumpHeight;
        public float Gravity => gravity;
        public float GroundedDownForce => groundedDownForce;
        public float StandingHeight => standingHeight;
        public float CrouchingHeight => crouchingHeight;
        public float CapsuleRadius => capsuleRadius;
        public float CrouchTransitionSpeed => crouchTransitionSpeed;
        public float GroundCheckRadius => groundCheckRadius;
        public float GroundCheckOffset => groundCheckOffset;
        public float StandingViewHeight => standingViewHeight;
        public float CrouchingViewHeight => crouchingViewHeight;
    }
}
