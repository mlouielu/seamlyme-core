/**
 * Default formulas for standard measurements that are derived from other measurements.
 * Used by `createDocument` when a named template is applied.
 */
export const DEFAULT_FORMULAS: Record<string, string> = {
  // Heights derived from other heights
  height_neck_back_to_knee: '(height_neck_back - height_knee)',
  height_waist_side_to_knee: '(height_waist_side - height_knee)',
  height_waist_side_to_hip: '(height_waist_side - height_hip)',
  height_knee_to_ankle: '(height_knee - height_ankle)',
  height_neck_back_to_waist_side: '(height_neck_back - height_waist_side)',
  height_waist_back: '(height_waist_front - leg_crotch_to_floor)',

  // Head
  head_crown_to_neck_back: '(height - height_neck_back)',
  head_chin_to_neck_back: '(height - height_neck_back - head_length)',

  // Front arc halves
  neck_arc_half_f: '(neck_arc_f/2)',
  highbust_arc_half_f: '(highbust_arc_f/2)',
  bust_arc_half_f: '(bust_arc_f/2)',
  lowbust_arc_half_f: '(lowbust_arc_f/2)',
  rib_arc_half_f: '(rib_arc_f/2)',
  waist_arc_half_f: '(waist_arc_f/2)',
  highhip_arc_half_f: '(highhip_arc_f/2)',
  hip_arc_half_f: '(hip_arc_f/2)',

  // Back arcs derived from circumference - front arc
  neck_arc_b: '(neck_circ - neck_arc_f)',
  highbust_arc_b: '(highbust_circ - highbust_arc_f)',
  bust_arc_b: '(bust_circ - bust_arc_f)',
  lowbust_arc_b: '(lowbust_circ - lowbust_arc_f)',
  rib_arc_b: '(rib_circ - rib_arc_f)',
  waist_arc_b: '(waist_circ - waist_arc_f)',
  highhip_arc_b: '(highhip_circ - highhip_arc_f)',
  hip_arc_b: '(hip_circ - hip_arc_f)',

  // Back arc halves
  neck_arc_half_b: '(neck_arc_b/2)',
  highbust_arc_half_b: '(highbust_arc_b/2)',
  bust_arc_half_b: '(bust_arc_b/2)',
  lowbust_arc_half_b: '(lowbust_arc_b/2)',
  rib_arc_half_b: '(rib_arc_b/2)',
  waist_arc_half_b: '(waist_arc_b/2)',
  highhip_arc_half_b: '(highhip_arc_b/2)',
  hip_arc_half_b: '(hip_arc_b/2)',

  // Hip with abdomen
  hip_circ_with_abdomen: '(hip_arc_b + hip_with_abdomen_arc_f)',

  // Torso vertical segments
  highbust_to_waist_f: '(neck_front_to_waist_f - neck_front_to_highbust_f)',
  bust_to_waist_f: '(neck_front_to_waist_f - neck_front_to_bust_f)',
  highbust_to_waist_b: '(neck_back_to_waist_b - neck_back_to_highbust_b)',
  bust_to_waist_b: '(neck_back_to_waist_b - neck_back_to_bust_b)',
  across_back_to_waist_b: '(neck_back_to_waist_b - neck_back_to_across_back)',

  // Width halves
  shoulder_tip_to_shoulder_tip_half_f: '(shoulder_tip_to_shoulder_tip_f/2)',
  across_chest_half_f: '(across_chest_f/2)',
  shoulder_tip_to_shoulder_tip_half_b: '(shoulder_tip_to_shoulder_tip_b/2)',
  across_back_half_b: '(across_back_b/2)',

  // Bustpoint
  bustpoint_to_bustpoint_half: '(bustpoint_to_bustpoint/2)',
  bustpoint_neck_side_to_waist: '(bustpoint_to_neck_side + bustpoint_to_waist)',

  // Arm segments
  arm_elbow_to_wrist_bent:
    '(arm_shoulder_tip_to_wrist_bent - arm_shoulder_tip_to_elbow_bent)',
  arm_elbow_to_wrist: '(arm_shoulder_tip_to_wrist - arm_shoulder_tip_to_elbow)',
  arm_elbow_to_wrist_inside: '(arm_armpit_to_wrist - arm_armpit_to_elbow)',
  arm_neck_side_to_wrist: '(shoulder_length + arm_shoulder_tip_to_wrist)',
  arm_neck_side_to_finger_tip:
    '(shoulder_length + arm_shoulder_tip_to_wrist + hand_length)',
  arm_neck_side_to_outer_elbow: '(shoulder_length + arm_shoulder_tip_to_elbow)',

  // Leg segments
  leg_crotch_to_ankle: '(leg_crotch_to_floor - height_ankle)',
  leg_waist_side_to_ankle: '(leg_waist_side_to_floor - height_ankle)',
  leg_waist_side_to_knee: '(leg_waist_side_to_floor - height_knee)',

  // Crotch / rise
  crotch_length_f: '(crotch_length - crotch_length_b)',
  rise_length_b: '(height_waist_back - leg_crotch_to_floor)',
  rise_length_f: '(height_waist_front - leg_crotch_to_floor)',

  // Natural waist
  waist_natural_arc_b: '(waist_natural_circ - waist_natural_arc_f)',
};

/**
 * Registry of named built-in templates.
 * Pass a key from this map as the `template` option in `createDocument`.
 */
export const NAMED_TEMPLATES: Record<string, Record<string, string>> = {
  default: DEFAULT_FORMULAS,
};
