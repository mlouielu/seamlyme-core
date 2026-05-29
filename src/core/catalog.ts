import type { SeamlyMeasurementDefinition } from './types.js';

export const SEAMLY_MEASUREMENT_ROWS = `
A01|height|Height: Total
A02|height_neck_back|Height: Neck Back
A03|height_scapula|Height: Scapula
A04|height_armpit|Height: Armpit
A05|height_waist_side|Height: Waist Side
A06|height_hip|Height: Hip
A07|height_gluteal_fold|Height: Gluteal Fold
A08|height_knee|Height: Knee
A09|height_calf|Height: Calf
A10|height_ankle_high|Height: Ankle High
A11|height_ankle|Height: Ankle
A12|height_highhip|Height: Highhip
A13|height_waist_front|Height: Waist Front
A14|height_bustpoint|Height: Bustpoint
A15|height_shoulder_tip|Height: Shoulder Tip
A16|height_neck_front|Height: Neck Front
A17|height_neck_side|Height: Neck Side
A18|height_neck_back_to_knee|Height: Neck Back to Knee
A19|height_waist_side_to_knee|Height: Waist Side to Knee
A20|height_waist_side_to_hip|Height: Waist Side to Hip
A21|height_knee_to_ankle|Height: Knee to Ankle
A22|height_neck_back_to_waist_side|Height: Neck Back to Waist Side
A23|height_waist_back|Height: Waist Back
B01|width_shoulder|Width: Shoulder
B02|width_bust|Width: Bust
B03|width_waist|Width: Waist
B04|width_hip|Width: Hip
B05|width_abdomen_to_hip|Width: Abdomen to Hip
C01|indent_neck_back|Indent: Neck Back
C02|indent_waist_back|Indent: Waist Back
C03|indent_ankle_high|Indent: Ankle High
D01|hand_palm_length|Hand: Palm length
D02|hand_length|Hand: Length
D03|hand_palm_width|Hand: Palm width
D04|hand_palm_circ|Hand: Palm circumference
D05|hand_circ|Hand: Circumference
E01|foot_width|Foot: Width
E02|foot_length|Foot: Length
E03|foot_circ|Foot: Circumference
E04|foot_instep_circ|Foot: Instep circumference
F01|head_circ|Head: Circumference
F02|head_length|Head: Length
F03|head_depth|Head: Depth
F04|head_width|Head: Width
F05|head_crown_to_neck_back|Head: Crown to Neck Back
F06|head_chin_to_neck_back|Head: Chin to Neck Back
G01|neck_mid_circ|Neck circumference midsection
G02|neck_circ|Neck circumference
G03|highbust_circ|Highbust circumference
G04|bust_circ|Bust circumference
G05|lowbust_circ|Lowbust circumference
G06|rib_circ|Rib circumference
G07|waist_circ|Waist circumference
G08|highhip_circ|Highhip circumference
G09|hip_circ|Hip circumference
G10|neck_arc_f|Neck arc front
G11|highbust_arc_f|Highbust arc front
G12|bust_arc_f|Bust arc front
G13|lowbust_arc_f|Lowbust arc front
G14|rib_arc_f|Rib arc front
G15|waist_arc_f|Waist arc front
G16|highhip_arc_f|Highhip arc front
G17|hip_arc_f|Hip arc front
G18|neck_arc_half_f|Neck arc front half
G19|highbust_arc_half_f|Highbust arc front half
G20|bust_arc_half_f|Bust arc front half
G21|lowbust_arc_half_f|Lowbust arc front half
G22|rib_arc_half_f|Rib arc front half
G23|waist_arc_half_f|Waist arc front half
G24|highhip_arc_half_f|Highhip arc front half
G25|hip_arc_half_f|Hip arc front half
G26|neck_arc_b|Neck arc back
G27|highbust_arc_b|Highbust arc back
G28|bust_arc_b|Bust arc back
G29|lowbust_arc_b|Lowbust arc back
G30|rib_arc_b|Rib arc back
G31|waist_arc_b|Waist arc back
G32|highhip_arc_b|Highhip arc back
G33|hip_arc_b|Hip arc back
G34|neck_arc_half_b|Neck arc back half
G35|highbust_arc_half_b|Highbust arc back half
G36|bust_arc_half_b|Bust arc back half
G37|lowbust_arc_half_b|Lowbust arc back half
G38|rib_arc_half_b|Rib arc back half
G39|waist_arc_half_b|Waist arc back half
G40|highhip_arc_half_b|Highhip arc back half
G41|hip_arc_half_b|Hip arc back half
G42|hip_with_abdomen_arc_f|Hip arc with Abdomen front
G43|body_armfold_circ|Body circumference at Armfold level
G44|body_bust_circ|Body circumference at Bust level
G45|body_torso_circ|Body circumference of full torso
G46|hip_circ_with_abdomen|Hip circumference including Abdomen
H01|neck_front_to_waist_f|Neck Front to Waist Front
H02|neck_front_to_waist_flat_f|Neck Front to Waist Front flat
H03|armpit_to_waist_side|Armpit to Waist Side
H04|shoulder_tip_to_waist_side_f|Shoulder Tip to Waist Side front
H05|neck_side_to_waist_f|Neck Side to Waist level front
H06|neck_side_to_waist_bustpoint_f|Neck Side to Waist level through Bustpoint
H07|neck_front_to_highbust_f|Neck Front to Highbust Front
H08|highbust_to_waist_f|Highbust Front to Waist Front
H09|neck_front_to_bust_f|Neck Front to Bust Front
H10|bust_to_waist_f|Bust Front to Waist Front
H11|lowbust_to_waist_f|Lowbust Front to Waist Front
H12|rib_to_waist_side|Rib Side to Waist Side
H13|shoulder_tip_to_armfold_f|Shoulder Tip to Armfold Front
H14|neck_side_to_bust_f|Neck Side to Bust level front
H15|neck_side_to_highbust_f|Neck Side to Highbust level front
H16|shoulder_center_to_highbust_f|Shoulder center to Highbust level front
H17|shoulder_tip_to_waist_side_b|Shoulder Tip to Waist Side back
H18|neck_side_to_waist_b|Neck Side to Waist level back
H19|neck_back_to_waist_b|Neck Back to Waist Back
H20|neck_side_to_waist_scapula_b|Neck Side to Waist level through Scapula
H21|neck_back_to_highbust_b|Neck Back to Highbust Back
H22|highbust_to_waist_b|Highbust Back to Waist Back
H23|neck_back_to_bust_b|Neck Back to Bust Back
H24|bust_to_waist_b|Bust Back to Waist Back
H25|lowbust_to_waist_b|Lowbust Back to Waist Back
H26|shoulder_tip_to_armfold_b|Shoulder Tip to Armfold Back
H27|neck_side_to_bust_b|Neck Side to Bust level back
H28|neck_side_to_highbust_b|Neck Side to Highbust level back
H29|shoulder_center_to_highbust_b|Shoulder center to Highbust level back
H30|waist_to_highhip_f|Waist Front to Highhip Front
H31|waist_to_hip_f|Waist Front to Hip Front
H32|waist_to_highhip_side|Waist Side to Highhip Side
H33|waist_to_highhip_b|Waist Back to Highhip Back
H34|waist_to_hip_b|Waist Back to Hip Back
H35|waist_to_hip_side|Waist Side to Hip Side
H36|shoulder_slope_neck_side_angle|Shoulder Slope Angle from Neck Side
H37|shoulder_slope_neck_side_length|Shoulder Slope length from Neck Side
H38|shoulder_slope_neck_back_angle|Shoulder Slope Angle from Neck Back
H39|shoulder_slope_neck_back_height|Shoulder Slope length from Neck Back
H40|shoulder_slope_shoulder_tip_angle|Shoulder Slope Angle from Shoulder Tip
H41|neck_back_to_across_back|Neck Back to Across Back
H42|across_back_to_waist_b|Across Back to Waist back
I01|shoulder_length|Shoulder length
I02|shoulder_tip_to_shoulder_tip_f|Shoulder Tip to Shoulder Tip front
I03|across_chest_f|Across Chest
I04|armfold_to_armfold_f|Armfold to Armfold front
I05|shoulder_tip_to_shoulder_tip_half_f|Shoulder Tip to Shoulder Tip front half
I06|across_chest_half_f|Across Chest half
I07|shoulder_tip_to_shoulder_tip_b|Shoulder Tip to Shoulder Tip back
I08|across_back_b|Across Back
I09|armfold_to_armfold_b|Armfold to Armfold back
I10|shoulder_tip_to_shoulder_tip_half_b|Shoulder Tip to Shoulder Tip back half
I11|across_back_half_b|Across Back half
I12|neck_front_to_shoulder_tip_f|Neck Front to Shoulder Tip
I13|neck_back_to_shoulder_tip_b|Neck Back to Shoulder Tip
I14|neck_width|Neck Width
J01|bustpoint_to_bustpoint|Bustpoint to Bustpoint
J02|bustpoint_to_neck_side|Bustpoint to Neck Side
J03|bustpoint_to_lowbust|Bustpoint to Lowbust
J04|bustpoint_to_waist|Bustpoint to Waist level
J05|bustpoint_to_bustpoint_half|Bustpoint to Bustpoint half
J06|bustpoint_neck_side_to_waist|Bustpoint Neck Side to Waist level
J07|bustpoint_to_shoulder_tip|Bustpoint to Shoulder Tip
J08|bustpoint_to_waist_front|Bustpoint to Waist Front
J09|bustpoint_to_bustpoint_halter|Bustpoint to Bustpoint Halter
J10|bustpoint_to_shoulder_center|Bustpoint to Shoulder center
K01|shoulder_tip_to_waist_front|Shoulder Tip to Waist Front
K02|neck_front_to_waist_side|Neck Front to Waist Side
K03|neck_side_to_waist_side_f|Neck Side to Waist Side front
K04|shoulder_tip_to_waist_back|Shoulder Tip to Waist Back
K05|shoulder_tip_to_waist_b_1in_offset|Shoulder Tip to Waist Back with 1in (2.54cm) offset
K06|neck_back_to_waist_side|Neck Back to Waist Side
K07|neck_side_to_waist_side_b|Neck Side to Waist Side back
K08|neck_side_to_armfold_f|Neck Side to Armfold Front
K09|neck_side_to_armpit_f|Neck Side to Highbust Side front
K10|neck_side_to_bust_side_f|Neck Side to Bust Side front
K11|neck_side_to_armfold_b|Neck Side to Armfold Back
K12|neck_side_to_armpit_b|Neck Side to Highbust Side back
K13|neck_side_to_bust_side_b|Neck Side to Bust Side back
L01|arm_shoulder_tip_to_wrist_bent|Arm: Shoulder Tip to Wrist bent
L02|arm_shoulder_tip_to_elbow_bent|Arm: Shoulder Tip to Elbow bent
L03|arm_elbow_to_wrist_bent|Arm: Elbow to Wrist bent
L04|arm_elbow_circ_bent|Arm: Elbow circumference bent
L05|arm_shoulder_tip_to_wrist|Arm: Shoulder Tip to Wrist
L06|arm_shoulder_tip_to_elbow|Arm: Shoulder Tip to Elbow
L07|arm_elbow_to_wrist|Arm: Elbow to Wrist
L08|arm_armpit_to_wrist|Arm: Armpit to Wrist inside
L09|arm_armpit_to_elbow|Arm: Armpit to Elbow inside
L10|arm_elbow_to_wrist_inside|Arm: Elbow to Wrist inside
L11|arm_upper_circ|Arm: Upper Arm circumference
L12|arm_above_elbow_circ|Arm: Above Elbow circumference
L13|arm_elbow_circ|Arm: Elbow circumference
L14|arm_lower_circ|Arm: Lower Arm circumference
L15|arm_wrist_circ|Arm: Wrist circumference
L16|arm_shoulder_tip_to_armfold_line|Arm: Shoulder Tip to Armfold line
L17|arm_neck_side_to_wrist|Arm: Neck Side to Wrist
L18|arm_neck_side_to_finger_tip|Arm: Neck Side to Finger Tip
L19|armscye_circ|Armscye: Circumference
L20|armscye_length|Armscye: Length
L21|armscye_width|Armscye: Width
L22|arm_neck_side_to_outer_elbow|Arm: Neck side to Elbow
M01|leg_crotch_to_floor|Leg: Crotch to floor
M02|leg_waist_side_to_floor|Leg: Waist Side to floor
M03|leg_thigh_upper_circ|Leg: Thigh Upper circumference
M04|leg_thigh_mid_circ|Leg: Thigh Middle circumference
M05|leg_knee_circ|Leg: Knee circumference
M06|leg_knee_small_circ|Leg: Knee Small circumference
M07|leg_calf_circ|Leg: Calf circumference
M08|leg_ankle_high_circ|Leg: Ankle High circumference
M09|leg_ankle_circ|Leg: Ankle circumference
M10|leg_knee_circ_bent|Leg: Knee circumference bent
M11|leg_ankle_diag_circ|Leg: Ankle diagonal circumference
M12|leg_crotch_to_ankle|Leg: Crotch to Ankle
M13|leg_waist_side_to_ankle|Leg: Waist Side to Ankle
M14|leg_waist_side_to_knee|Leg: Waist Side to Knee
N01|crotch_length|Crotch length
N02|crotch_length_b|Crotch length back
N03|crotch_length_f|Crotch length front
N04|rise_length_side_sitting|Rise length side sitting
N05|rise_length_diag|Rise length diagonal
N06|rise_length_b|Rise length back
N07|rise_length_f|Rise length front
N08|rise_length_side|Rise length side
O01|neck_back_to_waist_front|Neck Back to Waist Front
O02|waist_to_waist_halter|Waist to Waist Halter around Neck Back
O03|waist_natural_circ|Natural Waist circumference
O04|waist_natural_arc_f|Natural Waist arc front
O05|waist_natural_arc_b|Natural Waist arc back
O06|waist_to_natural_waist_f|Waist Front to Natural Waist Front
O07|waist_to_natural_waist_b|Waist Back to Natural Waist Back
O08|arm_neck_back_to_elbow_bent|Arm: Neck Back to Elbow high bend
O09|arm_neck_back_to_wrist_bent|Arm: Neck Back to Wrist high bend
O10|arm_neck_side_to_elbow_bent|Arm: Neck Side to Elbow high bend
O11|arm_neck_side_to_wrist_bent|Arm: Neck Side to Wrist high bend
O12|arm_across_back_center_to_elbow_bent|Arm: Across Back Center to Elbow high bend
O13|arm_across_back_center_to_wrist_bent|Arm: Across Back Center to Wrist high bend
O14|arm_armscye_back_center_to_wrist_bent|Arm: Armscye Back Center to Wrist high bend
P01|neck_back_to_bust_front|Neck Back to Bust Front
P02|neck_back_to_armfold_front|Neck Back to Armfold Front
P03|neck_back_to_armfold_front_to_waist_side|Neck Back over Shoulder to Waist Side
P04|highbust_back_over_shoulder_to_armfold_front|Highbust Back over Shoulder to Armfold Front
P05|highbust_back_over_shoulder_to_waist_front|Highbust Back over Shoulder to Waist Front
P06|neck_back_to_armfold_front_to_neck_back|Neck Back to Armfold Front to Neck Back
P07|across_back_center_to_armfold_front_to_across_back_center|Across Back Center circled around Shoulder
P08|neck_back_to_armfold_front_to_highbust_back|Neck Back to Armfold Front to Highbust Back
P09|armfold_to_armfold_bust|Armfold to Armfold front curved through Bust Front
P10|armfold_to_bust_front|Armfold to Bust Front
P11|highbust_b_over_shoulder_to_highbust_f|Highbust Back over Shoulder to Highbust level
P12|armscye_arc|Armscye: Arc
Q01|dart_width_shoulder|Dart Width: Shoulder
Q02|dart_width_bust|Dart Width: Bust
Q03|dart_width_waist|Dart Width: Waist
`;

export const SEAMLY_MEASUREMENT_CATALOG: SeamlyMeasurementDefinition[] =
  SEAMLY_MEASUREMENT_ROWS.trim().split('\n').map((row) => {
    const [id, name, fullName] = row.split('|');
    return { id, name, fullName };
  });

export const SEAMLY_BY_VAR: Record<string, SeamlyMeasurementDefinition> =
  Object.fromEntries(SEAMLY_MEASUREMENT_CATALOG.map((item) => [item.name, item]));

export const SEAMLY_BY_ID: Record<string, SeamlyMeasurementDefinition> =
  Object.fromEntries(SEAMLY_MEASUREMENT_CATALOG.map((item) => [item.id, item]));

export function lookupSeamlyMeasurement(name: string): SeamlyMeasurementDefinition | undefined {
  return SEAMLY_BY_VAR[name] ?? SEAMLY_BY_ID[name];
}
