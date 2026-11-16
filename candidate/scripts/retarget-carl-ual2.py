#!/usr/bin/env python3
"""Bake two UAL2 sword clips onto an unchanged Carl V2 GLB (Python stdlib).

This intentionally supports the inspected UAL2/Carl T-pose rigs, not arbitrary
characters. Both rigs are Y-up and face +Z. Rotations transfer as animated
world deltas from each source bind rotation onto the corresponding target bind
rotation; the target hierarchy converts those world rotations back to locals.
All target local translations/scales remain unchanged, except the hips' world
displacement is scaled by the ratio of target/source bind hips height. Source
root transforms participate in those world deltas even though root is unmapped.

No geometry, image, material, skin, inverse bind, existing accessor, original
animation, or original binary byte is rewritten. Additional animation buffers
are appended. A small offline hips-only lift clears the original skinned feet
from the bind-ground plane. This does not perform foot locking or IK.
"""

import argparse
import bisect
import copy
import hashlib
import json
import math
from pathlib import Path
import struct


def require(condition, message):
    if not condition:
        raise ValueError(message)


def finite(values):
    return all(math.isfinite(x) for x in values)


def vadd(a, b):
    return [x + y for x, y in zip(a, b)]


def vsub(a, b):
    return [x - y for x, y in zip(a, b)]


def vscale(a, k):
    return [x * k for x in a]


def norm(a):
    return math.sqrt(sum(x * x for x in a))


def qnormalize(q):
    length = norm(q)
    require(finite(q) and length > 1e-12, "Invalid quaternion")
    return [x / length for x in q]


def qmul(a, b):
    x, y, z, w = a
    X, Y, Z, W = b
    return [w * X + x * W + y * Z - z * Y,
            w * Y - x * Z + y * W + z * X,
            w * Z + x * Y - y * X + z * W,
            w * W - x * X - y * Y - z * Z]


def qinv(q):
    x, y, z, w = qnormalize(q)
    return [-x, -y, -z, w]


def qangle(a, b):
    a, b = qnormalize(a), qnormalize(b)
    dot = min(1.0, max(-1.0, abs(sum(x * y for x, y in zip(a, b)))))
    return math.degrees(2 * math.acos(dot))


def qslerp(a, b, fraction):
    a, b = qnormalize(a), qnormalize(b)
    dot = sum(x * y for x, y in zip(a, b))
    if dot < 0:
        b, dot = vscale(b, -1), -dot
    if dot > 0.9995:
        return qnormalize(vadd(vscale(a, 1 - fraction), vscale(b, fraction)))
    theta = math.acos(min(1.0, dot))
    return qnormalize(vadd(vscale(a, math.sin((1 - fraction) * theta) / math.sin(theta)),
                           vscale(b, math.sin(fraction * theta) / math.sin(theta))))


IDENTITY = [[1, 0, 0, 0], [0, 1, 0, 0], [0, 0, 1, 0], [0, 0, 0, 1]]


def matmul(a, b):
    return [[sum(a[i][k] * b[k][j] for k in range(4)) for j in range(4)] for i in range(4)]


def inverse(matrix):
    a = [list(row) + list(IDENTITY[i]) for i, row in enumerate(matrix)]
    for col in range(4):
        pivot = max(range(col, 4), key=lambda row: abs(a[row][col]))
        require(abs(a[pivot][col]) > 1e-12, "Singular transform")
        a[col], a[pivot] = a[pivot], a[col]
        div = a[col][col]
        a[col] = [x / div for x in a[col]]
        for row in range(4):
            if row != col:
                factor = a[row][col]
                a[row] = [x - factor * y for x, y in zip(a[row], a[col])]
    return [row[4:] for row in a]


def point(matrix, value):
    return [sum(matrix[i][j] * value[j] for j in range(3)) + matrix[i][3] for i in range(3)]


def trs_matrix(local):
    t, q, s = local
    x, y, z, w = qnormalize(q)
    return [[(1 - 2 * (y*y + z*z))*s[0], 2*(x*y-z*w)*s[1], 2*(x*z+y*w)*s[2], t[0]],
            [2*(x*y+z*w)*s[0], (1 - 2*(x*x+z*z))*s[1], 2*(y*z-x*w)*s[2], t[1]],
            [2*(x*z-y*w)*s[0], 2*(y*z+x*w)*s[1], (1 - 2*(x*x+y*y))*s[2], t[2]],
            [0, 0, 0, 1]]


class Glb:
    def __init__(self, path):
        self.path = Path(path)
        self.raw = self.path.read_bytes()
        require(len(self.raw) >= 20, "Truncated GLB")
        magic, version, length = struct.unpack_from('<4sII', self.raw)
        require(magic == b'glTF' and version == 2 and length == len(self.raw), "Expected valid GLB 2")
        chunks, pos = [], 12
        while pos < length:
            size, kind = struct.unpack_from('<II', self.raw, pos)
            pos += 8
            require(pos + size <= length and size % 4 == 0, "Invalid GLB chunk")
            chunks.append((kind, self.raw[pos:pos + size]))
            pos += size
        require([x[0] for x in chunks] == [0x4E4F534A, 0x004E4942], "Expected JSON and BIN chunks")
        self.doc = json.loads(chunks[0][1])
        self.binary = chunks[1][1]
        require(len(self.doc['buffers']) == 1 and 'uri' not in self.doc['buffers'][0], "Expected embedded buffer")
        require(self.doc['buffers'][0]['byteLength'] <= len(self.binary), "Buffer exceeds BIN")
        self.sha256 = hashlib.sha256(self.raw).hexdigest()

    def accessor(self, index, allow_unsigned=False):
        acc = self.doc['accessors'][index]
        allowed = (5121, 5123, 5125, 5126) if allow_unsigned else (5126,)
        require('sparse' not in acc and acc['componentType'] in allowed and not acc.get('normalized'),
                "Expected dense float accessor (or unsigned joints)")
        components = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4, 'MAT4': 16}[acc['type']]
        code = {5121: 'B', 5123: 'H', 5125: 'I', 5126: 'f'}[acc['componentType']]
        width = struct.calcsize(code)
        view = self.doc['bufferViews'][acc['bufferView']]
        require(view.get('buffer', 0) == 0, "External buffer unsupported")
        offset = view.get('byteOffset', 0) + acc.get('byteOffset', 0)
        stride = view.get('byteStride', components * width)
        require(stride >= components * width, "Invalid accessor stride")
        end = offset + max(0, acc['count'] - 1) * stride + components * width
        require(end <= len(self.binary) and end <= view.get('byteOffset', 0) + view['byteLength'], "Accessor out of range")
        rows = [list(struct.unpack_from('<' + code * components, self.binary, offset + i * stride))
                for i in range(acc['count'])]
        require(all(finite(row) for row in rows), "Non-finite source accessor")
        return rows


class Rig:
    def __init__(self, glb):
        self.glb = glb
        nodes = glb.doc['nodes']
        require(len(glb.doc['skins']) == 1 and len(glb.doc['skins'][0]['joints']) == 65, "Expected inspected 65-joint rig")
        self.joints = set(glb.doc['skins'][0]['joints'])
        self.names = {n['name']: i for i, n in enumerate(nodes) if 'name' in n}
        require(len(self.names) == len(nodes), "Expected distinct node names")
        self.parents = [None] * len(nodes)
        for i, node in enumerate(nodes):
            require('matrix' not in node, "Expected explicit TRS nodes")
            for child in node.get('children', []):
                require(self.parents[child] is None, "Node has multiple parents")
                self.parents[child] = i
        self.order, visiting, done = [], set(), set()
        def visit(i):
            require(i not in visiting, "Cyclic hierarchy")
            if i in done:
                return
            visiting.add(i)
            if self.parents[i] is not None:
                visit(self.parents[i])
            visiting.remove(i)
            done.add(i)
            self.order.append(i)
        for i in range(len(nodes)):
            visit(i)
        self.bind = []
        for node in nodes:
            t, q, s = list(node.get('translation', [0, 0, 0])), list(node.get('rotation', [0, 0, 0, 1])), list(node.get('scale', [1, 1, 1]))
            require(len(t) == 3 and len(q) == 4 and len(s) == 3 and finite(t + q + s), "Invalid bind TRS")
            require(max(abs(x - 1) for x in s) < 3e-5, "Expected near-unit bind scales; general scaled rigs need different handling")
            self.bind.append((t, qnormalize(q), s))
        self.bind_q, self.bind_m = self.world(self.bind)
        matrices = glb.accessor(glb.doc['skins'][0]['inverseBindMatrices'])
        errors = []
        for joint, values in zip(glb.doc['skins'][0]['joints'], matrices):
            ibm = [[values[col * 4 + row] for col in range(4)] for row in range(4)]
            product = matmul(self.bind_m[joint], ibm)
            errors.append(max(abs(product[i][j] - IDENTITY[i][j]) for i in range(4) for j in range(4)))
        self.bind_inverse_error = max(errors)
        require(self.bind_inverse_error < 1e-4, "Default pose is not the expected skin bind pose")

    def world(self, local):
        qworld, mworld = [None] * len(local), [None] * len(local)
        for i in self.order:
            parent = self.parents[i]
            qworld[i] = qnormalize(local[i][1] if parent is None else qmul(qworld[parent], local[i][1]))
            mworld[i] = trs_matrix(local[i]) if parent is None else matmul(mworld[parent], trs_matrix(local[i]))
        return qworld, mworld

    def position(self, index):
        return point(self.bind_m[index], [0, 0, 0])


class Clip:
    def __init__(self, rig, name):
        clips = [a for a in rig.glb.doc['animations'] if a.get('name') == name]
        require(len(clips) == 1, 'Missing or duplicate source clip: ' + name)
        animation = clips[0]
        require(len(animation['channels']) == 195, name + ': expected TRS for all 65 joints')
        self.name, self.rig, self.tracks = name, rig, {}
        self.times = None
        for channel in animation['channels']:
            node, path = channel['target']['node'], channel['target']['path']
            require(node in rig.joints and path in ('translation', 'rotation', 'scale'), "Unexpected source channel")
            require((node, path) not in self.tracks, "Duplicate source channel")
            sampler = animation['samplers'][channel['sampler']]
            require(sampler.get('interpolation', 'LINEAR') == 'LINEAR', "Prototype requires LINEAR source tracks")
            times = [row[0] for row in rig.glb.accessor(sampler['input'])]
            values = rig.glb.accessor(sampler['output'])
            require(len(times) == len(values) and len(times) >= 2 and times[0] == 0,
                    "Unexpected source sampling")
            require(all(b > a for a, b in zip(times, times[1:])), "Non-monotonic source times")
            require(all(len(row) == (4 if path == 'rotation' else 3) for row in values), "Unexpected source vector width")
            if self.times is None:
                self.times = times
            require(self.times == times, "Expected a shared uniform source timeline")
            if path == 'rotation':
                require(max(abs(norm(row) - 1) for row in values) < 3e-5, "Source quaternion is not normalized")
                values = [qnormalize(row) for row in values]
            if path == 'scale':
                require(max(abs(x - 1) for row in values for x in row) < 3e-5, "Animated source scale is outside the supported near-unit rig")
            self.tracks[node, path] = values
        require(set(self.tracks) == {(i, p) for i in rig.joints for p in ('translation', 'rotation', 'scale')}, "Incomplete source TRS")
        self.duration = self.times[-1]

    def sample(self, time):
        time = max(0, min(self.duration, time))
        left = min(len(self.times) - 2, max(0, bisect.bisect_right(self.times, time) - 1))
        factor = (time - self.times[left]) / (self.times[left + 1] - self.times[left])
        local = copy.deepcopy(self.rig.bind)
        paths = {'translation': 0, 'rotation': 1, 'scale': 2}
        for (node, path), values in self.tracks.items():
            row = qslerp(values[left], values[left + 1], factor) if path == 'rotation' else vadd(vscale(values[left], 1 - factor), vscale(values[left + 1], factor))
            current = list(local[node])
            current[paths[path]] = row
            local[node] = tuple(current)
        return local


def bone_names():
    pairs = [('pelvis', 'Hips'), ('spine_01', 'Spine'), ('spine_02', 'Spine1'),
             ('spine_03', 'Spine2'), ('neck_01', 'Neck'), ('Head', 'Head')]
    for side, label in [('l', 'Left'), ('r', 'Right')]:
        for source, target in [('clavicle', 'Shoulder'), ('upperarm', 'Arm'), ('lowerarm', 'ForeArm'),
                               ('hand', 'Hand'), ('thigh', 'UpLeg'), ('calf', 'Leg'),
                               ('foot', 'Foot'), ('ball', 'ToeBase'), ('ball_leaf', 'Toe_End')]:
            pairs.append((source + '_' + side, label + target))
        for finger in ['index', 'middle', 'ring', 'pinky', 'thumb']:
            for number in range(1, 5):
                source = f'{finger}_{number:02d}' + ('_leaf' if number == 4 else '') + '_' + side
                pairs.append((source, f'{label}Hand{finger.title()}{number}'))
    return [(s, 'mixamorig:' + t) for s, t in pairs]


def native_bounds(glb):
    rows = []
    for mesh in glb.doc['meshes']:
        for primitive in mesh['primitives']:
            rows.extend(glb.accessor(primitive['attributes']['POSITION']))
    return {'min': [min(row[i] for row in rows) for i in range(3)],
            'max': [max(row[i] for row in rows) for i in range(3)]}


def interpolate_pose(a, b, fraction):
    """Match LINEAR glTF translation and quaternion interpolation."""
    return [(vadd(vscale(at, 1 - fraction), vscale(bt, fraction)), qslerp(aq, bq, fraction), list(asc))
            for (at, aq, asc), (bt, bq, bsc) in zip(a, b)]


class SoleClearance:
    """Evaluate original weighted foot vertices; correct only the hips' Y track."""
    clearance = 0.00025  # 0.026% of Carl's height; protects Float32/interpolation.
    probes_per_interval = 12

    def __init__(self, rig, hips):
        self.rig, self.hips = rig, hips
        doc, glb = rig.glb.doc, rig.glb
        mesh_nodes = [i for i, node in enumerate(doc['nodes']) if 'mesh' in node]
        require(len(mesh_nodes) == 1 and doc['nodes'][mesh_nodes[0]].get('skin') == 0, "Expected Carl's single skinned mesh")
        require(max(abs(rig.bind_m[mesh_nodes[0]][i][j] - IDENTITY[i][j]) for i in range(4) for j in range(4)) < 1e-6,
                "Floor correction expects Carl's mesh in model coordinates")
        parent = rig.parents[hips]
        require(parent is not None and max(abs(rig.bind_m[parent][i][j] - IDENTITY[i][j]) for i in range(4) for j in range(4)) < 1e-6,
                "Floor correction expects hips beneath an identity Armature")
        skin = doc['skins'][0]
        inverse_binds = [[[values[col*4+row] for col in range(4)] for row in range(4)]
                         for values in glb.accessor(skin['inverseBindMatrices'])]
        foot_joints = {i for i, node in enumerate(skin['joints'])
                       if 'Foot' in doc['nodes'][node]['name'] or 'Toe' in doc['nodes'][node]['name']}
        bounds = native_bounds(glb)
        threshold = bounds['min'][1] + (bounds['max'][1] - bounds['min'][1]) * 0.15
        self.vertices = []
        for primitive in doc['meshes'][doc['nodes'][mesh_nodes[0]]['mesh']]['primitives']:
            attrs = primitive['attributes']
            require('JOINTS_1' not in attrs and 'WEIGHTS_1' not in attrs, "Unexpected extra skin influences")
            positions = glb.accessor(attrs['POSITION'])
            joint_rows = glb.accessor(attrs['JOINTS_0'], allow_unsigned=True)
            weights = glb.accessor(attrs['WEIGHTS_0'])
            require(len(positions) == len(joint_rows) == len(weights), "Mismatched skin vertex counts")
            for position, joints, weight in zip(positions, joint_rows, weights):
                require(len(joints) == len(weight) == 4 and abs(sum(weight) - 1) < 3e-5 and min(weight) >= 0, "Unexpected skin weights")
                require(all(isinstance(j, int) and 0 <= j < len(skin['joints']) for j in joints), "Invalid skin joint index")
                if position[1] > threshold and sum(w for j, w in zip(joints, weight) if j in foot_joints) < 0.25:
                    continue
                influences = []
                for joint, w in zip(joints, weight):
                    if w:
                        p = point(inverse_binds[joint], position)
                        influences.append((skin['joints'][joint], p[0]*w, p[1]*w, p[2]*w, w))
                self.vertices.append(influences)
        require(100 < len(self.vertices) < 5000, "Unexpected foot-vertex selection for Carl")
        self.bind_ground = self.minimum(rig.bind)

    def minimum(self, pose):
        _, matrices = self.rig.world(pose)
        rows = [matrix[1] for matrix in matrices]
        minimum = math.inf
        for influences in self.vertices:
            y = 0
            for joint, x, yy, z, w in influences:
                row = rows[joint]
                y += row[0]*x + row[1]*yy + row[2]*z + row[3]*w
            minimum = min(minimum, y)
        require(math.isfinite(minimum), "Non-finite posed sole bounds")
        return minimum

    def correct(self, poses):
        corrected = copy.deepcopy(poses)
        lifts = []
        raw_minimum = math.inf
        target = self.bind_ground + self.clearance
        for pose in corrected:
            minimum = self.minimum(pose)
            raw_minimum = min(raw_minimum, minimum)
            lift = max(0, target - minimum)
            pose[self.hips][0][1] += lift
            lifts.append(lift)
        # Quaternion interpolation can make a sole dip between keys. Raise both
        # adjacent hips keys by the measured deficit, leaving all rotations and
        # X/Z values unchanged. A second pass verifies the resulting path.
        for iteration in range(3):
            additions = [0.0] * len(corrected)
            minimum = min(self.minimum(pose) for pose in corrected)
            for i, (left, right) in enumerate(zip(corrected, corrected[1:])):
                for probe in range(1, self.probes_per_interval):
                    y = self.minimum(interpolate_pose(left, right, probe / self.probes_per_interval))
                    minimum = min(minimum, y)
                    deficit = max(0, target - y)
                    additions[i] = max(additions[i], deficit)
                    additions[i+1] = max(additions[i+1], deficit)
            if min(minimum - self.bind_ground, 0) >= -1e-7:
                break
            require(iteration < 2, "Interframe ground clearance did not converge")
            for i, extra in enumerate(additions):
                corrected[i][self.hips][0][1] += extra + 1e-7 if extra else 0
                lifts[i] += extra + 1e-7 if extra else 0
        require(minimum >= self.bind_ground - 1e-7, "Soles still penetrate between keys")
        # Require exact preservation of X/Z, bone-local offsets, scales and all
        # rotations. Only the root joint's vertical translation may differ.
        for before, after in zip(poses, corrected):
            for node, (a, b) in enumerate(zip(before, after)):
                require(a[1:] == b[1:], "Floor correction changed rotation or scale")
                require(a[0][0] == b[0][0] and a[0][2] == b[0][2], "Floor correction changed horizontal trajectory")
                require(node == self.hips or a[0] == b[0], "Floor correction changed a bone offset")
        return corrected, {'selectedFootVertices': len(self.vertices), 'bindGroundY': self.bind_ground,
                           'clearanceMargin': self.clearance, 'maximumHipsLift': max(lifts),
                           'minimumSoleYBefore': raw_minimum, 'minimumSoleYAfterInterframeChecks': minimum,
                           'interframeProbeCount': (len(poses)-1)*self.probes_per_interval + 1,
                           'policy': 'Nonnegative hips-Y lift from original skinned feet; preserve rotations, bone offsets, scales, and hips X/Z; no foot locking or IK.'}


def generate(args):
    source, target = Glb(args.source), Glb(args.target)
    sr, tr = Rig(source), Rig(target)
    require([a['name'] for a in target.doc['animations']] == ['box_01', 'fall', 'box_02', 'box_03'], "Expected unmodified Carl V2 with four original clips")
    names = bone_names()
    require(all(s in sr.names and t in tr.names for s, t in names), "The expected UAL2/Carl mapping is unavailable")
    mapping = {tr.names[t]: sr.names[s] for s, t in names}
    require(len(mapping) == 64, "Expected 64 distinct mapped joints")
    require(sr.joints - set(mapping.values()) == {sr.names['root']}, "Unexpected unmatched source joints")
    require(tr.joints - set(mapping) == {tr.names['mixamorig:HeadTop_End']}, "Unexpected unmatched target joints")
    source_hip, target_hip = sr.names['pelvis'], tr.names['mixamorig:Hips']
    root = sr.names['root']
    require(sr.parents[source_hip] == root, "Expected UAL2 root parent of pelvis")
    require(tr.parents[target_hip] not in tr.joints, "Expected Carl hips as root joint")
    # Reject unexpected orientation/reference poses rather than invent an axis conversion.
    for rig, hip, hand, arm, foot, toe, head in [
            (sr, source_hip, 'hand_r', 'upperarm_r', 'foot_r', 'ball_r', 'Head'),
            (tr, target_hip, 'mixamorig:RightHand', 'mixamorig:RightArm', 'mixamorig:RightFoot', 'mixamorig:RightToeBase', 'mixamorig:Head')]:
        handpos, armpos = rig.position(rig.names[hand]), rig.position(rig.names[arm])
        require(handpos[0] < armpos[0] and abs(handpos[1] - armpos[1]) < 0.03, "Expected right arm extending toward -X in T pose")
        require(rig.position(rig.names[toe])[2] > rig.position(rig.names[foot])[2], "Expected +Z forward")
        require(rig.position(rig.names[head])[1] > rig.position(hip)[1] > 0, "Expected Y-up rig")
    scale = tr.position(target_hip)[1] / sr.position(source_hip)[1]
    require(0.5 < scale < 0.65, "Unexpected Carl/UAL2 hip-height ratio")
    attack, recovery = Clip(sr, 'Sword_Regular_A'), Clip(sr, 'Sword_Regular_A_Rec')
    require(len(attack.times) == 14 and len(recovery.times) == 30, "Unexpected A/A_Rec sampling")
    require(abs(attack.duration - 13/30) < 1e-6 and abs(recovery.duration - 29/30) < 1e-6, "Unexpected A/A_Rec duration")

    def retarget(source_local):
        source_q, source_m = sr.world(source_local)
        target_local, target_q, target_m = copy.deepcopy(tr.bind), [None]*len(tr.bind), [None]*len(tr.bind)
        for node in tr.order:
            parent = tr.parents[node]
            parent_q = [0, 0, 0, 1] if parent is None else target_q[parent]
            parent_m = IDENTITY if parent is None else target_m[parent]
            t, q, s = target_local[node]
            if node in mapping:
                source_node = mapping[node]
                delta = qmul(source_q[source_node], qinv(sr.bind_q[source_node]))
                world_q = qmul(delta, tr.bind_q[node])
                q = qnormalize(qmul(qinv(parent_q), world_q))
                if node == target_hip:
                    displacement = vsub(point(source_m[source_node], [0, 0, 0]), sr.position(source_node))
                    world_p = vadd(tr.position(node), vscale(displacement, scale))
                    t = point(inverse(parent_m), world_p)
            target_local[node] = (t, q, s)
            target_q[node] = qnormalize(qmul(parent_q, q))
            target_m[node] = matmul(parent_m, trs_matrix(target_local[node]))
        return target_local, target_q, target_m

    # The bind-to-bind transfer must reconstruct Carl, including his bone rolls.
    rest_local, rest_q, rest_m = retarget(sr.bind)
    rest_error = max(qangle(rest_q[i], tr.bind_q[i]) for i in tr.joints)
    rest_pos_error = max(norm(vsub(point(rest_m[i], [0, 0, 0]), tr.position(i))) for i in tr.joints)
    require(rest_error < 1e-4 and rest_pos_error < 1e-6, "Bind/rest retarget alignment failed")
    root_errors = []
    for clip in [attack, recovery]:
        for time in clip.times:
            local = clip.sample(time)
            root_errors.append(max(norm(vsub(local[root][0], sr.bind[root][0])),
                                   qangle(local[root][1], sr.bind[root][1]),
                                   norm(vsub(local[root][2], sr.bind[root][2]))))
    require(max(root_errors) < 1e-4, "Expected non-root-motion donor root fixed at bind")

    seam_a, seam_b = attack.sample(attack.duration), recovery.sample(0)
    seam_rotation = max(qangle(seam_a[i][1], seam_b[i][1]) for i in sr.joints)
    seam_target_a, seam_target_b = retarget(seam_a)[0], retarget(seam_b)[0]
    seam_hip = norm(vsub(seam_target_a[target_hip][0], seam_target_b[target_hip][0]))
    require(seam_rotation < 1.0 and seam_hip < 0.001, "A/A_Rec join is too discontinuous for this prototype")

    output = copy.deepcopy(target.doc)
    binary = bytearray(target.binary)
    baked_q_errors = []

    def append_accessor(rows, kind, include_bounds=False):
        require(rows and all(finite(row) for row in rows), "Non-finite baked output")
        while len(binary) % 4:
            binary.append(0)
        offset = len(binary)
        flat = [x for row in rows for x in row]
        packed = struct.pack('<' + 'f'*len(flat), *flat)
        binary.extend(packed)
        view = len(output['bufferViews'])
        output['bufferViews'].append({'buffer': 0, 'byteOffset': offset, 'byteLength': len(packed)})
        accessor = {'bufferView': view, 'componentType': 5126, 'count': len(rows), 'type': kind}
        if include_bounds:
            accessor.update(min=[min(row[i] for row in rows) for i in range(len(rows[0]))],
                            max=[max(row[i] for row in rows) for i in range(len(rows[0]))])
        index = len(output['accessors'])
        output['accessors'].append(accessor)
        return index

    def bake(name, times, locals_, provenance):
        require(all(b > a for a, b in zip(times, times[1:])), "Output times must increase")
        time_accessor = append_accessor([[t] for t in times], 'SCALAR', True)
        animation = {'name': name, 'channels': [], 'samplers': [], 'extras': provenance}
        for node in sorted(mapping):
            rotations = []
            for pose in locals_:
                q = qnormalize(pose[node][1])
                if rotations and sum(x*y for x, y in zip(rotations[-1], q)) < 0:
                    q = vscale(q, -1)
                rotations.append(q)
                packed_q = struct.unpack('<4f', struct.pack('<4f', *q))
                baked_q_errors.append(abs(norm(packed_q) - 1))
            value_accessor = append_accessor(rotations, 'VEC4')
            sampler = len(animation['samplers'])
            animation['samplers'].append({'input': time_accessor, 'output': value_accessor, 'interpolation': 'LINEAR'})
            animation['channels'].append({'sampler': sampler, 'target': {'node': node, 'path': 'rotation'}})
        hip_accessor = append_accessor([pose[target_hip][0] for pose in locals_], 'VEC3')
        sampler = len(animation['samplers'])
        animation['samplers'].append({'input': time_accessor, 'output': hip_accessor, 'interpolation': 'LINEAR'})
        animation['channels'].append({'sampler': sampler, 'target': {'node': target_hip, 'path': 'translation'}})
        return animation, locals_

    base_times = attack.times + [attack.duration + t for t in recovery.times[1:]]
    poses = [attack.sample(t) for t in attack.times] + [recovery.sample(t) for t in recovery.times[1:]]
    base_locals = [retarget(pose)[0] for pose in poses]
    # Insert halfway keys at approximately 60 fps without changing the original
    # interpolated rotation or horizontal translation paths.
    attack_times, attack_locals = [], []
    for i in range(len(base_times)-1):
        attack_times.extend([base_times[i], (base_times[i] + base_times[i+1]) / 2])
        attack_locals.extend([base_locals[i], interpolate_pose(base_locals[i], base_locals[i+1], 0.5)])
    attack_times.append(base_times[-1])
    attack_locals.append(base_locals[-1])
    floor = SoleClearance(tr, target_hip)
    corrected_locals, floor_report = floor.correct(attack_locals)
    # The held ready pose must match the corrected attack's first frame exactly.
    ready_pose = corrected_locals[0]
    ready, ready_locals = bake('UAL2_Sword_Ready', [0.0, 1.0], [ready_pose, ready_pose],
                              {'sourceClip': attack.name, 'sourceTime': 0, 'heldPose': True,
                               'groundClearance': 'Same corrected hips Y as attack start; no IK.'})
    combined, combined_locals = bake('UAL2_Sword_Regular_A', attack_times, corrected_locals,
                                    {'sourceClips': [attack.name, recovery.name],
                                     'joinTime': attack.duration,
                                     'joinPolicy': 'Keep attack endpoint; omit duplicate recovery t=0; interpolate to next recovery sample.',
                                     'groundClearance': 'Hips-Y lift from original skinned foot bounds; approximately 60 fps; no foot locking or IK.'})
    output['animations'] = [ready, combined] + output['animations']
    output['buffers'][0]['byteLength'] = len(binary)
    # Check preservation before writing; the independent project test checks it again.
    preserved = ['asset', 'scene', 'scenes', 'nodes', 'meshes', 'materials', 'skins', 'textures', 'images', 'samplers']
    require(all(output.get(key) == target.doc.get(key) for key in preserved), "Target structure changed")
    require(output['accessors'][:len(target.doc['accessors'])] == target.doc['accessors'], "Original accessors changed")
    require(output['bufferViews'][:len(target.doc['bufferViews'])] == target.doc['bufferViews'], "Original buffer views changed")
    require(output['animations'][2:] == target.doc['animations'], "Original animations changed")
    require(bytes(binary[:len(target.binary)]) == target.binary, "Original BIN changed")
    require(max(baked_q_errors) < 1e-6, "Baked quaternion precision failed")
    for poses_ in [ready_locals, combined_locals]:
        for pose in poses_:
            for node in range(len(tr.bind)):
                require(pose[node][2] == tr.bind[node][2], "Target bone scale changed")
                if node != target_hip:
                    require(pose[node][0] == tr.bind[node][0], "Non-hip translation changed")
    encoded = json.dumps(output, separators=(',', ':'), ensure_ascii=False, allow_nan=False).encode()
    encoded += b' ' * ((-len(encoded)) % 4)
    binary += b'\x00' * ((-len(binary)) % 4)
    result = (struct.pack('<4sII', b'glTF', 2, 12+8+len(encoded)+8+len(binary)) +
              struct.pack('<II', len(encoded), 0x4E4F534A) + encoded +
              struct.pack('<II', len(binary), 0x004E4942) + binary)
    out_path = Path(args.out)
    require(out_path.resolve() not in {source.path.resolve(), target.path.resolve()}, "Output must be a new copy")
    out_path.parent.mkdir(parents=True, exist_ok=True)
    temporary = out_path.with_suffix(out_path.suffix + '.tmp')
    temporary.write_bytes(result)
    temporary.replace(out_path)
    report = {
        'source': {'file': source.path.name, 'archiveMember': args.source_member, 'bytes': len(source.raw), 'sha256': source.sha256,
                   'rootMotionVariant': 'non-RM', 'reference': 'bind T pose', 'axisAlignment': 'identity; Y up and +Z forward'},
        'target': {'file': target.path.name, 'bytes': len(target.raw), 'sha256': target.sha256,
                   'originalClips': [a['name'] for a in target.doc['animations']], 'nativeMeshBounds': native_bounds(target)},
        'output': {'file': out_path.name, 'bytes': len(result), 'sha256': hashlib.sha256(result).hexdigest(),
                   'clips': [{'name': ready['name'], 'duration': 1, 'samples': 2, 'channels': 65},
                             {'name': combined['name'], 'duration': attack_times[-1], 'samples': len(attack_times), 'channels': 65}]},
        'retarget': {'mappedJoints': len(mapping), 'unmappedSource': ['root'], 'unmappedTarget': ['mixamorig:HeadTop_End'],
                     'hipDisplacementScale': scale, 'rootMotionPolicy': 'Include source root in world transforms; root remains fixed in selected non-RM clips; retain scaled pelvis displacement.',
                     'targetLocalTranslations': 'Original bind values except hips', 'targetLocalScales': 'Original bind values for all nodes',
                     'rotationRule': 'inverse(targetParentAnimatedWorld) * (sourceAnimatedWorld * inverse(sourceBindWorld)) * targetBindWorld'},
        'sourceClips': [{'name': attack.name, 'duration': attack.duration, 'samples': len(attack.times)},
                        {'name': recovery.name, 'duration': recovery.duration, 'samples': len(recovery.times)}],
        'groundClearance': floor_report,
        'checks': {'allSourceAndOutputValuesFinite': True, 'originalBinaryPrefixPreserved': True,
                   'originalMeshImagesSkinBindNodesAndClipsPreserved': True,
                   'sourceBindInverseMaxError': sr.bind_inverse_error, 'targetBindInverseMaxError': tr.bind_inverse_error,
                   'restWorldRotationMaxErrorDegrees': rest_error, 'restWorldPositionMaxError': rest_pos_error,
                   'sourceRootBindMaxError': max(root_errors), 'bakedQuaternionNormMaxError': max(baked_q_errors),
                   'seamLocalRotationMaxDegrees': seam_rotation, 'seamScaledHipsDistance': seam_hip,
                   'attackStartEndLocalRotationMaxDegrees': max(qangle(combined_locals[0][i][1], combined_locals[-1][i][1]) for i in mapping),
                   'attackStartEndHipsDistance': norm(vsub(combined_locals[0][target_hip][0], combined_locals[-1][target_hip][0]))},
        'limitations': ['Held ready pose has no idle motion.', 'Floor clearance lifts hips only; no foot locking, IK, body/weapon collision correction, or weapon orientation correction.',
                        'Attack retains authored recovery endpoint; it is not forced into a seamless loop.'],
        'mapping': [{'source': s, 'target': t} for s, t in names]
    }
    if args.report:
        Path(args.report).write_text(json.dumps(report, indent=2, allow_nan=False) + '\n')
    print(json.dumps({key: report[key] for key in ['source', 'output', 'retarget', 'sourceClips', 'groundClearance', 'checks']}, indent=2))
    return report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', required=True, help='UAL2 Standard non-RM GLB (or equivalent Source member)')
    parser.add_argument('--target', required=True, help='Unmodified Carl V2 GLB')
    parser.add_argument('--out', required=True, help='New GLB output path')
    parser.add_argument('--report', help='Optional generation report JSON path')
    parser.add_argument('--source-member', default='Unreal-Godot/UAL2_Standard.glb', help='Archive member path recorded for provenance')
    args = parser.parse_args()
    try:
        generate(args)
    except (ValueError, KeyError, IndexError, struct.error) as error:
        parser.exit(1, 'Retarget failed: ' + str(error) + '\n')


if __name__ == '__main__':
    main()
